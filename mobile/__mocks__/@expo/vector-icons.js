const React = require('react');
const { View } = require('react-native');

const MaterialCommunityIcons = (props) => {
    return React.createElement(View, { ...props, testID: 'mock-icon' });
};

const Ionicons = (props) => {
    return React.createElement(View, { ...props, testID: 'mock-ionicon' });
};

module.exports = {
    MaterialCommunityIcons,
    Ionicons,
};
