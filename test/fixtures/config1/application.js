'use strict';

var Layout = require('./layout.js');
var Short = require('./short');


var items = ['short'];
var short = function() {

};

define(['app'], function (app) {

    var directives = {};
    directives.gps = function () {
        return {
            restrict: "E",
            replace: true,
            templateUrl: 'view/gps.html',
            link: function (scope, element, attrs, interfacePanel) {


            },
            controller: function ($scope, $snapshot) {


            }
        };
    };

    directives.logo = function () {
        return {
            restrict: "E",
            replace: true,
            template: "<img src=\"img/image1.jpg\" />test</h1>",
            link: function (scope, element, attrs, interfacePanel) {


            },
            controller: function ($scope, $snapshot) {


            }
        };
    };

    app.directive(directives);


});

//# sourceMappingURL=application.js.map
