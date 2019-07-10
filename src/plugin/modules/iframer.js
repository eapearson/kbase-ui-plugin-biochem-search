define(['kb_lib/html', 'kb_lib/windowChannel', 'kb_lib/httpUtils'], function(html, WindowChannel, httpUtils) {
    'use strict';

    var t = html.tag,
        div = t('div'),
        iframe = t('iframe');

    class Iframe {
        constructor(config) {
            // having the host be configurable means we can also host
            // this plugin somewhere else.
            this.origin = config.origin;
            this.pathRoot = config.pathRoot;

            // So we can deterministically find the iframe
            this.id = 'frame_' + html.genId();

            this.useChannel = config.channelId ? true : false;

            const params = {
                frameId: this.id,
                parentHost: document.location.origin,
                params: config.params
            };

            if (config.channelId) {
                params.channelId = config.channelId;
            }

            // All plugins need to follow this pattern for the index for now (but that
            // could be part of the constructor...)
            const indexPath = this.pathRoot + '/iframe_root/index.html';

            // Make an absolute url to this.
            this.url = this.origin + '/' + indexPath;

            // The iframe framework, designed to give a full height and width responsive
            // window with the content area of the ui.
            this.content = div(
                {
                    style: {
                        flex: '1 1 0px',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                },
                [
                    iframe({
                        id: this.id,
                        name: this.id,
                        dataKBTesthookIframe: 'plugin-iframe',
                        dataParams: encodeURIComponent(JSON.stringify(params)),
                        style: {
                            width: '100%',
                            flex: '1 1 0px',
                            display: 'flex',
                            flexDirection: 'column'
                        },
                        frameborder: '0',
                        scrolling: 'no'
                        // src: url
                    })
                ]
            );

            this.node = null;
        }

        attach(node) {
            this.node = node;
            this.node.innerHTML = this.content;
            this.iframe = document.getElementById(this.id);
            this.window = this.iframe.contentWindow;
        }

        start() {
            this.iframe.src = this.url;
        }
    }

    class Iframer {
        constructor(config) {
            this.container = config.node;
            this.pluginPath = config.pluginPath;
            this.runtime = config.runtime;
            this.params = config.params;

            this.id = 'host_' + html.genId();

            // this.hostOrigin = document.location.origin;
            // this.iframeOrigin = document.location.origin;

            // this.channel = new WindowChannel.Channel({
            //     window: window,
            //     host: document.location.origin,
            //     // recieveFor: [this.id],
            //     // clientId: this.iframe.id,
            //     // hostId: this.id
            // });

            // Will be created when the "ready" message is received.
            this.iframeChannel = null;

            this.iframe = new Iframe({
                origin: document.location.origin,
                pathRoot: this.pluginPath,
                // channelId: this.channel.id,
                // channelId: this.id,
                hostId: this.id,
                params: this.params
            });

            this.iframe.attach(this.container);

            // this.iframeMessages = new WindowMessages({
            //     // window: window,
            //     host: document.location.origin,
            //     clientId: this.iframe.id,
            //     hostId: this.id
            // });
        }

        // Lifecycle

        /*
                                    iframe messages lifecycle.

                                    create iframe, don't set source yet
                                    set up postmessage listener on the iframe content window
                                    listem for 'ready' message
                                    load content for iframe
                                    content will set up listening on window's postmessage too
                                    content sends 'ready' message
                                    host receives ready message and finishes setting up postmessage listener for the
                                        iframe client
                                    host sets up all listeners to support client
                                    life goes on
                                    when client is being removed e.g. for navigation it is sent the 'stop' message given
                                        some interval in which to finish this work before it is just axed.
                                    */

        setupChannel() {
            this.channel = new WindowChannel.Channel({
                window: this.iframe.window,
                host: document.location.origin,
                channelId: this.id
            });

            this.channel.on('get-auth-status', () => {
                this.channel.send('auth-status', {
                    token: this.runtime.service('session').getAuthToken(),
                    username: this.runtime.service('session').getUsername()
                });
            });

            this.channel.on('get-config', () => {
                this.channel.send('config', {
                    value: this.runtime.rawConfig()
                });
            });

            this.channel.on('add-button', ({ button }) => {
                button.callback = () => {
                    this.iframeChannel.send.apply(this.iframeChannel, button.callbackMessage);
                };
                this.runtime.send('ui', 'addButton', button);
            });

            this.channel.on('open-window', ({ url }) => {
                window.location.href = url;
                // window.open(url, name);
            });

            this.channel.on('set-plugin-params', ({ pluginParams }) => {
                if (Object.keys(pluginParams) === 0) {
                    window.location.search = '';
                    return;
                }
                const query = {};
                if (pluginParams.query) {
                    query.query = pluginParams.query;
                }
                if (pluginParams.dataPrivacy && pluginParams.dataPrivacy.length > 0) {
                    query.dataPrivacy = pluginParams.dataPrivacy.join(',');
                }
                if (pluginParams.workspaceTypes && pluginParams.workspaceTypes.length > 0) {
                    query.workspaceTypes = pluginParams.workspaceTypes.join(',');
                }
                if (pluginParams.dataTypes) {
                    query.dataTypes = pluginParams.dataTypes.join(',');
                }

                // prepare the params.
                const queryString = httpUtils.encodeQuery(query);

                const currentLocation = window.location.toString();
                const currentURL = new URL(currentLocation);
                currentURL.search = queryString;
                history.pushState(null, '', currentURL.toString());

                // window.location.search = queryString;
            });

            this.channel.on('send-instrumentation', (instrumentation) => {
                this.runtime.service('instrumentation').send(instrumentation);
            });

            this.channel.on('ready', () => {
                this.channel.send('start', {
                    token: this.runtime.service('session').getAuthToken(),
                    username: this.runtime.service('session').getUsername(),
                    realname: this.runtime.service('session').getRealname(),
                    email: this.runtime.service('session').getEmail(),
                    config: this.runtime.rawConfig()
                });
                this.runtime.receive('session', 'loggedin', () => {
                    this.channel.send('loggedin', {
                        token: this.runtime.service('session').getAuthToken(),
                        username: this.runtime.service('session').getUsername(),
                        realname: this.runtime.service('session').getRealname(),
                        email: this.runtime.service('session').getEmail()
                    });
                });
                this.runtime.receive('session', 'loggedout', () => {
                    this.channel.send('loggedout', {});
                });
            });

            this.channel.start();
        }

        start() {
            return new Promise((resolve, reject) => {
                this.iframe.start();

                if (this.useChannel) {
                    try {
                        this.iframe.iframe.addEventListener(
                            'load',
                            () => {
                                this.setupChannel();
                                resolve();
                            },
                            {
                                once: true
                            }
                        );
                    } catch (ex) {
                        reject(ex);
                    }
                }
            });
        }

        stop() {
            this.container.innerHTML = '';

            const currentLocation = window.location.toString();
            const currentURL = new URL(currentLocation);
            currentURL.search = '';
            history.pushState(null, '', currentURL.toString());

            if (this.channel) {
                return this.channel.stop();
            }
        }
    }

    return Iframer;
});
