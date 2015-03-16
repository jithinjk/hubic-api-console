angular.module('consoleApp').service('Api', function ($q, Ovh) {
    'use strict';

    this.getRoot = function () {
        return Ovh.getSchema('/?null');
    };

    function parseParameters (api, parameters) {

        _.forEach(parameters, function (param) {

            // parameter is a model?
            param.isModel = !!api.models[param.dataType];

            // parameter is an enum?
            param.isEnum = param.isModel && !!api.models[param.dataType].enum;

            // format complex type
            if (param.isModel) {

                if (param.isEnum) {
                    param.enum = api.models[param.dataType];
                } else {

                    param.name = api.models[param.dataType].id;     // Because missing name 

                    param.modelProperties = [];   

                    var modelProperties = _.pick(api.models[param.dataType].properties, function (val) { return val.readOnly === 0; });

                    _.forEach(modelProperties, function (modelPropertieVal, modelPropertieName) {
                        param.modelProperties.push({
                            dataType    : modelPropertieVal.type,
                            description : modelPropertieVal.description,
                            name        : modelPropertieName,
                            paramType   : param.paramType,
                            required    : modelPropertieVal.canBeNull ? 0 : 1
                        });
                    });

                    // loop!
                    parseParameters(api, param.modelProperties);
                }
            }
        });

    }

    this.getSubApi = function (path) {
        return Ovh.getSchema(path).then(function (subApi) {

            subApi.original = _.cloneDeep(subApi);

            // reorganize from operations
            if (subApi.apis && subApi.apis.length) {
                var subApiList = [];

                _.forEach(subApi.apis, function (api) {
                    _.forEach(api.operations, function (operation) {

                        // responseType is a model?
                        operation.responseTypeIsModel = !!subApi.models[operation.responseType];

                        // erk... need to find a better solution
                        operation.parameters = _.sortByOrder(operation.parameters, ['paramType'], [false]);
                        
                        // check operation params
                        parseParameters(subApi, operation.parameters);

                        // Here it is
                        subApiList.push({
                            path        : api.path,
                            description : api.description,
                            operation   : operation
                        });

                    });
                });

                subApi.apis = _.sortBy(subApiList, 'path');
            }

            return subApi;
        });
    };


    // function parseRequestedApiParams (param)

    this.requestApi = function (api) {

        var config = {};

        _.forEach(api.operation.parameters, function (param) {

            //if (param.isModel && !param.isEnum) {

                // if complex type, go into its properties, else simply takes param
            _.forEach(( (param.isModel && !param.isEnum) ? param.modelProperties : [param]), function (_param) {
                switch (_param.paramType) {
                case 'path':
                    if (!config.params) {
                        config.params = {};
                    }
                    config.params[_param.name] = _param.value;
                    break;
                case 'body':
                    if (!config.data) {
                        config.data = {};
                    }
                    config.data[_param.name] = _param.value;
                    break;
                }
            });

            /*} else {
                switch (param.paramType) {
                case 'path':
                    if (!config.params) {
                        config.params = {};
                    }
                    config.params[param.name] = param.value;
                    break;
                case 'body':
                    if (!config.data) {
                        config.data = {};
                    }
                    config.data[param.name] = param.value;
                    break;
                }
            }*/
        });

        var startTime = new Date().getTime();
        return Ovh[api.operation.httpMethod.toLowerCase()](api.path, config).then(function (response) {
            response.requestTime = new Date().getTime() - startTime;
            return response;
        }, function (response) {
            response.requestTime = new Date().getTime() - startTime;
            return $q.reject(response);
        });
    };

});