require([
    'vendor/underscore',
    'vendor/jquery',
    'mesh',
    'example'
], function(_, $, mesh, Example) {
    var manager = Example.models, last_ajax_call;

    var ajax_failed = function() {
        ok(false, 'ajax request failed');
        start();
    };

    module('models', {
        setup: function() {
            mesh.Request.prototype.ajax = function(params) {
                last_ajax_call = params;
                return $.ajax(params);
            };
        },
        teardown: function() {
            mesh.Request.ajax = $.ajax;
        }
    });

    test('instantiation', function() {
        var model = Example();
        strictEqual(model.id, null);
        ok(_.isString(model.cid) && model.cid.length > 0);
        deepEqual(model._changes, {});
        ok(!model._loaded);
        strictEqual(model._manager, model.__models__);
        strictEqual(manager.models[model.cid], model);

        var same_model = manager.get(model.cid);
        strictEqual(same_model, model);

        model = Example({integer_field: 2});
        strictEqual(model.integer_field, 2);
        deepEqual(model._changes, {});
    });

    test('attribute handling', function() {
        var model = Example();
        ok(!model.has('integer_field'));

        var retval = model.set('integer_field', 2);
        strictEqual(retval, model);

        ok(model.has('integer_field'));
        strictEqual(model.integer_field, 2);
        strictEqual(model.html('integer_field'), '2');
        deepEqual(model._changes, {integer_field: true});

        model.set({integer_field: 4, text_field: 'text'});
        strictEqual(model.integer_field, 4);
        strictEqual(model.text_field, 'text');
        deepEqual(model._changes, {integer_field: true, text_field: true});
    });

    test('change events', function() {
        var model = Example(), calls = 0;
        model.on('change', function(event, changed_model, changes) {
            strictEqual(event, 'change');
            strictEqual(changed_model, model);
            strictEqual(model.integer_field, 2);
            deepEqual(changes, {integer_field: true});
            calls++;
        });

        strictEqual(calls, 0);
        model.set('integer_field', 2);
        strictEqual(calls, 1);

        model.set('integer_field', 2);
        strictEqual(calls, 1);
    });

    asyncTest('lifecycle', function() {
        var model = Example({required_field: 'test'});
        strictEqual(model.id, null);
        ok(!model._loaded);

        model.save().then(function(saved_model) {
            var id = model.id;
            strictEqual(saved_model, model);
            ok(model.id);
            ok(model._loaded);
            strictEqual(manager.models[model.id], model);
            deepEqual(model._changes, {});

            manager.clear();
            model = manager.get(id);
            ok(model);
            strictEqual(model.id, id);
            strictEqual(model.cid, null);
            ok(!model.has('required_field'));

            model.refresh().then(function(refreshed_model) {
                strictEqual(refreshed_model, model);
                strictEqual(model.required_field, 'test');

                model.set('text_field', 'text');
                model.save().then(function() {
                    deepEqual($.parseJSON(last_ajax_call.data), {text_field: 'text'});
                    strictEqual(model.text_field, 'text');
                    deepEqual(model._changes, {});

                    model.destroy().then(function(response) {
                        deepEqual(response, {id: model.id});
                        strictEqual(manager.models[model.id], undefined);
                        start();
                    }, ajax_failed);
                }, ajax_failed);
            }, ajax_failed);
        }, ajax_failed);
    });

    asyncTest('unknown resource', function() {
        var model = Example.models.get(2);
        model.refresh().then(ajax_failed, function(error, xhr) {
            ok(!model._loaded);
            start();
        });
    });

});
