import React, { Component } from 'react';
import PropTypes from 'prop-types';

export default class Tab extends Component {
    constructor(props) {
        super(props);
    }

    onClick() {
        const { label, onClick } = this.props;
        onClick(label);
    }

    render() {
        const { activeTab, label } = this.props;

        let className = 'tab-list-item';

        if (activeTab === label) {
            className += ' tab-list-active';
        }

        return (
            <li className={className} onClick={this.onClick.bind(this)}>
                {label}
            </li>
        );
    }
}

Tab.propTypes = {
    activeTab: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired
};