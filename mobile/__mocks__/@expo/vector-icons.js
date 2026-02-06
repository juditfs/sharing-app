const React = require('react');
const { View } = require('react-native');

const MaterialCommunityIcons = (props) => {
    return React.createElement(View, { ...props, testID: 'mock-icon' });
};

module.exports = {
    MaterialCommunityIcons,
};
