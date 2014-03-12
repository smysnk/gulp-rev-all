'use strict';

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

    app.directive(directives);


});

