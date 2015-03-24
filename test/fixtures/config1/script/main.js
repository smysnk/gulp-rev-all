/*global require*/
'use strict';


require.config({
	paths: {
        
        angular: '../lib/angular',
        bootstrap: '/lib/bootstrap',
        jquery: '../lib/jquery',
        lodash: 'lodash',

        
        // bootstrap: '//maxcdn.bootstrapcdn.com/bootstrap/3.3.2/js/bootstrap.min',
        // jquery: '//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min',
        // underscore: '//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min',
        // lodash: '//cdnjs.cloudflare.com/ajax/libs/lodash.js/2.4.1/lodash.underscore.min',

	},
	shim: {
        lodash: { exports: '_' },
        jquery: { exports: 'jQuery' },
        angular: { deps: ['jquery'], exports: 'angular' },
        bootstrap: { deps: ['jquery'] }
	}
});

require([
    'angular', 
    'app'
], function (angular) {

    angular.bootstrap(document, ['app']);
 
});
