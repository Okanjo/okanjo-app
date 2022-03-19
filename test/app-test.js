const should = require('should');
const Cluster = require('cluster');
const OkanjoApp = require("../OkanjoApp");
const ravenUnitTestAppUri = process.env.SENTRY_URI;

const sharedConfig = {
    ravenReportUri: ravenUnitTestAppUri,
    reportToSentry: true,

    connectionString: "default!",
    otherSetting: "yup",

    service: {
        url: "http://overyet.com"
    },

    dev: {
        connectionString: "dev!",
        devOnlySetting: "yuppers",

        service: {
            url: "http://is.winter.overyet.com"
        }
    }
};

if (Cluster.isWorker) return;

if (process.env.running_under_istanbul) {
    // use coverage for forked process
    // disabled reporting and output for child process
    // enable pid in child process coverage filename
    Cluster.setupMaster({
        exec: './node_modules/.bin/istanbul',
        args: [
            'cover',  '--print', 'none',  '--include-pid',
            process.argv[1], '--'].concat(process.argv.slice(2))
    });
}

describe('OkanjoApp', function() {

    describe('construction', () => {

        it('should instantiate', () => {

            // Clear the env var if present
            delete process.env.env;

            const app = new OkanjoApp({});

            app.should.not.be.empty();
            app.should.be.instanceof(OkanjoApp);

            // Should not init in shutdown mode, that's silly
            app.gracefulShutdown.should.be.exactly(false);

            // Env should be init as default
            app.currentEnvironment.should.be.equal('default');

            // Verify reporting context
            app._reportToSentry.should.be.exactly(false);
            app.reportingContext.should.be.an.Object();
            app.reportingContext.environment.should.be.equal('default');

            // Verify the error reporter exists
            app.ravenClient.should.be.an.Object();

            // Verify the boom response is linked up
            app.response.should.be.a.Function();
        });

        it('handles process environment settings', () => {

            // Set the process environment, like it would be when an app is actually run
            process.env.env = "dev";

            const config = {

                // default value
                connectionString: "default!",
                otherSetting: "yup",

                service: {
                    url: "http://overyet.com"
                },

                // dev env value
                dev: {
                    connectionString: "dev!",
                    devOnlySetting: "yuppers",

                    service: {
                        url: "http://is.winter.overyet.com",
                        agent: {
                            host: "poop"
                        }
                    }
                }
            };

            // Instantiate the app
            const app = new OkanjoApp(config);

            // Check it
            app.currentEnvironment.should.be.equal('dev');
            app.reportingContext.environment.should.be.equal('dev');

            // Check that the config applied correctly
            app.config.connectionString.should.be.equal('dev!');
            app.config.otherSetting.should.be.equal('yup');
            app.config.devOnlySetting.should.be.equal('yuppers');
            app.config.service.url.should.be.equal('http://is.winter.overyet.com');
            app.config.service.agent.host.should.be.exactly('poop');

            delete process.env.env;
        });

        it('handles deep copy elastic issues', () => {

            process.env.env = 'sandbox';

            const config = {
                elasticsearch: {
                    host: '192.168.99.100:1234',
                    requestTimeout: 300000,
                    log: 'warning', // error, warning, info, debug, trace
                    //log: 'debug', // error, warning, info, debug, trace
                    defaultIndex: 'myapp',
                    indexSchemas: {
                        myapp: {
                            mappings: {
                                product: {

                                    // For dynamic string fields, don't try to make them into dates
                                    date_detection: false,

                                    // Configure mappings of dynamic fields (ones we don't manually specify)
                                    dynamic_templates: [],

                                    // Document properties
                                    properties: {

                                        something: {
                                            type: "string",
                                            index: "not_analyzed",
                                            include_in_all: false
                                        }
                                    }
                                }
                            }
                        }
                    }
                },

                indices: {
                    myapp: {
                        name: 'myapp',
                        types: {
                            product: 'product'
                        }
                    }
                },

                sandbox: {
                    indices: {
                        myapp: {
                            name: "myapp-sandbox"
                        }
                    }
                }
            };


            const app = new OkanjoApp(config);

            app.config.indices.myapp.name.should.be.exactly('myapp-sandbox');

            //app.dump('CONFIG IS', app.config);

            delete process.env.env;
        });

        it('handles process environment settings in default env', () => {

            // Set the process environment, like it would be when an app is actually run
            process.env.env = "default";

            const config = {

                // default value
                connectionString: "default!",
                otherSetting: "yup",

                service: {
                    url: "http://overyet.com"
                },

                // dev env value
                dev: {
                    connectionString: "dev!",
                    devOnlySetting: "yuppers",

                    service: {
                        url: "http://is.winter.overyet.com",
                        agent: {
                            host: "poop"
                        }
                    }
                }
            };

            // Instantiate the app
            const app = new OkanjoApp(config);

            // Check it
            app.currentEnvironment.should.be.equal('default');
            app.reportingContext.environment.should.be.equal('default');

            // Check that the config applied correctly
            app.config.connectionString.should.be.equal('default!');
            app.config.otherSetting.should.be.equal('yup');
            should(app.config.devOnlySetting).be.exactly(undefined);
            app.config.service.url.should.be.equal('http://overyet.com');
            should(app.config.service.agent).be.exactly(undefined);

            delete process.env.env;
        });

        it('dies on missing env config', () => {
            try {

                // Set the process environment, like it would be when an app is actually run
                process.env.env = "derp";

                const config = {

                    connectionString: "default!",

                    // dev env value
                    dev: {
                        connectionString: "dev!"
                    }
                };

                // Instantiate the app
                new OkanjoApp(config);

                // mmm nope.
                "we got here".should.equal("we should NOT have gotten here, idiot");

            } catch (e) {

                e.should.be.an.Object();
                e.should.be.an.instanceof(Error);
                e.message.indexOf('Oops!').should.equal(0);

            }

            delete process.env.env;
        });

    });

    describe('dump', () => {

        const app = new OkanjoApp({});

        it('should accept nothing', () => {
            app.dump();
        });

        it('should a bunch of stuff', () => {
            app.dump({},"a",1,true,[],new Error('THIS IS ONLY A TEST'));
        });

        it('should not make a mess out of debugging', () => {
            const res = require('util').inspect(app);
            res.should.not.match(/showHidden/); // we're not triggering the custom inspector
            res.should.match(/currentEnvironment/); // we are showing our own properties
        });

    });

    describe('error reporting', () => {

        const app = new OkanjoApp({
            ravenReportUri: ravenUnitTestAppUri
        });

        it('report() should accept nothing', async () => {
            const res = await app.report();

            res.should.be.an.Object();
            should(res.err).be.exactly(undefined);
            res.meta.should.be.an.Object();
            Object.keys(res.meta).length.should.be.exactly(0);
            res.reported.should.be.exactly(false);
        });

        it('report() should accept a bunch of stuff', async () => {

            const err = new Error('THIS IS ONLY A TEST');
            const res = await app.report({}, "a", 1, true, [], err);

            res.should.be.an.Object();
            should(res.err).be.exactly(err);
            res.meta.should.be.an.Object();
            Object.keys(res.meta).length.should.be.exactly(5); // minus one cuz err gets yanked
            res.reported.should.be.exactly(false);
        });

        it('can upgrade reporting status', () => {

            delete process.env.env;

            const app = new OkanjoApp({
                ravenReportUri: ravenUnitTestAppUri,
                reportToSentry: true
            });

            app._reportToSentry.should.be.exactly(true);


        });

        it('does not upgrade reporting status in default env', () => {

            delete process.env.env;

            const app = new OkanjoApp({
                ravenReportUri: ravenUnitTestAppUri,
                reportToSentry: false,

                dev: {
                    reportToSentry: true
                }
            });

            app._reportToSentry.should.be.exactly(false);


        });

        it('can upgrade reporting status in different env', () => {

            process.env.env = "dev";

            const app = new OkanjoApp({
                ravenReportUri: ravenUnitTestAppUri,
                reportToSentry: false,

                dev: {
                    reportToSentry: true
                }
            });

            app._reportToSentry.should.be.exactly(true);
            delete process.env.env;
        });

        it('can set reporting context', () => {

            const app = new OkanjoApp({
                ravenReportUri: ravenUnitTestAppUri
            });

            app.setReportingContext({
                worker: "unit tests!"
            });

            app.reportingContext.environment.should.not.be.empty();
            app.reportingContext.worker.should.equal('unit tests!');

        });

        it('can report to sentry and gen error', async () => {

            const app = new OkanjoApp({
                ravenReportUri: ravenUnitTestAppUri,
                reportToSentry: true
            });

            const res = await app.report(1, 'Generate unit test error for me');
            should(res.err).be.instanceof(Error);
            res.err.message.should.equal('Report: Generate unit test error for me');
            res.reported.should.be.exactly(true);

        });

        it('can report nothing to sentry', async () => {

            // but why would you want to, anyway?

            const app = new OkanjoApp({
                ravenReportUri: ravenUnitTestAppUri,
                reportToSentry: true
            });

            const res = await app.report();
            should(res.err).be.instanceof(Error);
            res.reported.should.be.exactly(true);

        });

        it('can report to sentry with given error', async () => {

            const app = new OkanjoApp({
                ravenReportUri: ravenUnitTestAppUri,
                reportToSentry: true
            });

            const err = new Error('Hand rolled error'),
                res = await app.report('What I was doing?', err);
            should(res.err).be.exactly(err);
            res.reported.should.be.exactly(true);


        });

        it('can report uncaught exceptions', done => {

            // can't really unit test a process exception cuz mocha captures it

            const app = new OkanjoApp({
                ravenReportUri: ravenUnitTestAppUri,
                reportToSentry: true
            });

            app._reportUncaughtException(new Error('Fall down go boom'), "testing - do not exit");

            process.nextTick(done);
        });

        it('silences reports when asked', async () => {

            process.env.SILENCE_REPORTS = true;

            const app = new OkanjoApp(sharedConfig);

            await app.report('Best to be seen and not heard');

            process.env.SILENCE_REPORTS  = undefined;

        });

        it('passes environment on fork with default env', function (done) {
            this.timeout(5000);

            delete process.env.env;

            const app = new OkanjoApp(sharedConfig);

            const worker = Cluster.fork({env: app.currentEnvironment, mode: 'basic'});

            worker.on('exit', () => {
                done();
            });

        });

        it('passes environment on fork with named env', function (done) {
            this.timeout(5000);

            process.env.env = 'dev';

            const app = new OkanjoApp(sharedConfig);

            const worker = Cluster.fork({env: app.currentEnvironment, mode: 'dev'});

            worker.on('exit', () => {
                done();
            });

            delete process.env.env;

        });

        it('exits when an unhandled exception occurs', function (done) {
            this.timeout(5000);

            delete process.env.env;

            const app = new OkanjoApp(sharedConfig);

            const worker = Cluster.fork({env: app.currentEnvironment, mode: 'explode'});

            worker.on('exit', () => {
                done();
            });

        });

    });

    describe('copy', () => {

        it('copy should deep copy', () => {

            const app = new OkanjoApp({});

            const original = {
                key: 'str',
                val: 123,
                arr: [1, 2, 3],
                obj: {a: 1, b: 2},

                nil: null,

                arrDeep: [1, {c: 3, d: {e: 99, a: [3, 3]}}]
            };

            const target = {
                existing: true
            };


            app.copy(target, original);

            // Existing property should remain
            target.existing.should.be.exactly(true);

            // New props should copy
            target.key.should.be.equal('str');
            target.obj.a.should.equal(1);
            target.arr.length.should.be.equal(3);

            // Null value should have retained
            should(target.nil).be.exactly(null);

            // New props should be different references than the original
            target.arr.should.not.be.exactly(original.arr);
            target.obj.should.not.be.exactly(original.obj);
            target.arrDeep.should.not.be.exactly(original.arrDeep);

            // The new deep prop should match the original
            target.arrDeep.should.deepEqual(original.arrDeep);

        });

        it('should apply settings like we expect', () => {

            const settings = {
                type: 'products',
                skip: 0,
                take: 1,
                backfill: {
                    type: 'products',
                    pools: ['SafetyNet™']
                }
            };

            const settingsOne = {
                take: 4,
                pools: ['global'],
                backfill: {
                    type: 'articles',
                    take: 1
                }
            };

            OkanjoApp.copy(settings, settingsOne);

            settings.should.deepEqual({
                type: 'products',
                skip: 0,
                take: 4,
                pools: ['global'],
                backfill: {
                    type: 'articles',
                    pools: ['SafetyNet™'],
                    take: 1
                }
            });

            OkanjoApp.copy(settings, settings.backfill);

            settings.should.deepEqual({
                type: 'articles',
                skip: 0,
                take: 1,
                pools: ['SafetyNet™'],
                backfill: {
                    type: 'articles',
                    pools: ['SafetyNet™'],
                    take: 1
                }
            });

        });
    });

    describe('flattenData', () => {

        it('should flatten a complex object into a single-dimension map', () => {

            function ObjectID(value = "ffffffffffffffffffffffff") {
                this.value = value;
            }

            ObjectID.prototype.toString = function() {
                return this.value;
            };

            const ctorLessObj = Object.create(null);
            ctorLessObj.z = "asdf";

            const source = {
                a: 1,
                b: [ 2, 3, 4 ],
                c: {
                    c_a: 5,
                    c_b: {
                        c_b_a: "chicken bacon artichoke",
                        c_b_b: undefined
                    },
                    c_c: null
                },
                d: new ObjectID(),
                e: new Date(),
                f: ctorLessObj
            };

            const expected = {
                a: 1,
                b_0: 2,
                b_1: 3,
                b_2: 4,
                c_c_a: 5,
                c_c_b_c_b_a: "chicken bacon artichoke",
                c_c_b_c_b_b: undefined,
                d: source.d.toString(),
                e: source.e,
                f_z: "asdf"
            };

            OkanjoApp.flattenData(source).should.deepEqual(expected);

            // Empty source checks
            OkanjoApp.flattenData(undefined).should.deepEqual({});
            OkanjoApp.flattenData(null).should.deepEqual({});

            // Date to iso
            const now = new Date();
            OkanjoApp.flattenData({ now }, { dateToIso: true }).should.deepEqual({ now: now.toISOString()});
        });

    });

    describe('log', () => {

        it('should log stuff', () => {
            const app = new OkanjoApp({});
            process.env.SILENCE_REPORTS = undefined;
            app.log('Hi there!');
        });

        it('should not log stuff', () => {
            const app = new OkanjoApp({});
            process.env.SILENCE_REPORTS = true;
            app.log('Hi there!');
            process.env.SILENCE_REPORTS = undefined;
        });

    });

    describe('connectToServices', () => {

        it('should start services correctly', done => {

            const app = new OkanjoApp(sharedConfig);
            let gotReady = false,
                gotCallback = false;

            function checkDone() {
                if (gotReady && gotCallback) {
                    // If we call connectToServices again, it should just callback right away because it's already connected
                    app.connectToServices(done);
                }
            }

            // Register a fake service connection
            app.registerServiceConnector(cb => {
                // Delay until the next event loop
                process.nextTick(cb);
            });

            app.once('ready', () => {
                gotReady = true;
                checkDone();
            });

            app._connecting.should.be.exactly(false);

            // Start the app up
            app.connectToServices(() => {

                // Ready should be done
                app.ready.should.be.exactly(true);

                gotCallback = true;
                checkDone();
            });

        });

        it('should start services correctly with async fn', async () => {

            const app = new OkanjoApp(sharedConfig);
            let gotReady = false;
            let gotCallback = false;

            async function checkDone() {
                if (gotReady && gotCallback) {
                    // If we call connectToServices again, it should just callback right away because it's already connected
                    app.ready.should.be.exactly(true);
                    await app.connectToServices();
                }

                await app.connectToServices();
            }

            // Register a fake service connection
            app.registerServiceConnector(cb => {
                // Delay until the next event loop
                process.nextTick(() => cb());
            });

            app.once('ready', async () => {
                gotReady = true;
                await checkDone();
            });

            app._connecting.should.be.exactly(false);
            app.ready.should.be.exactly(false);

            // Start the app up
            await app.connectToServices();

            // Ready should be done
            app.ready.should.be.exactly(true);

            gotCallback = true;

        });

        it('should start services correctly with promise', async () => {

            const app = new OkanjoApp(sharedConfig);
            let gotReady = false;
            let gotCallback = false;

            async function checkDone() {
                if (gotReady && gotCallback) {
                    // If we call connectToServices again, it should just callback right away because it's already connected
                    app.ready.should.be.exactly(true);
                    await app.connectToServices();
                }

                await app.connectToServices();
            }

            // Register a fake service connection
            app.registerServiceConnector(new Promise(resolve => {
                // Delay until the next event loop
                process.nextTick(resolve);
            }));

            app.once('ready', async () => {
                gotReady = true;
                await checkDone();
            });

            app._connecting.should.be.exactly(false);
            app.ready.should.be.exactly(false);

            // Start the app up
            await app.connectToServices();

            // Ready should be done
            app.ready.should.be.exactly(true);

            gotCallback = true;

        });

        it('should stop the app if there are service connector errors', async () => {

            const app = new OkanjoApp(sharedConfig);
            let gotErrorEvent = false;

            // Register a fake service connection
            app.registerServiceConnector(async () => {
                console.log('bang');
                throw new Error('KABOOM');
            });

            app.once('ready', async () => {
                throw new Error('This should not fire');
            });

            app.once('error', async () => {
                gotErrorEvent.should.be.exactly(false);
                gotErrorEvent = true;
            });

            app._connecting.should.be.exactly(false);
            app.ready.should.be.exactly(false);

            // Start the app up
            try {
                await app.connectToServices();
            } catch(err) {
                err.message.should.be.exactly('KABOOM');
            }

            // Ready should be done
            app.ready.should.be.exactly(false);

        });

        it('should stop the app if there are service connector errors w/ callbacks', (done) => {

            const app = new OkanjoApp(sharedConfig);
            let gotErrorEvent = false;

            // Register a fake service connection
            app.registerServiceConnector(async () => {
                throw new Error('KABOOM');
            });

            app.once('ready', async () => {
                throw new Error('This should not fire');
            });

            app.once('error', async () => {
                gotErrorEvent.should.be.exactly(false);
                gotErrorEvent = true;
            });

            app._connecting.should.be.exactly(false);
            app.ready.should.be.exactly(false);

            // Start the app up
            app.connectToServices((err) => {
                err.message.should.be.exactly('KABOOM');

                // Ready should be done
                app.ready.should.be.exactly(false);
                done();
            });
        });

        it('should start services even if none registered', done => {

            const app = new OkanjoApp(sharedConfig);
            let gotReady = false,
                gotCallback = false;

            function checkDone() {
                if (gotReady && gotCallback) {
                    // If we call connectToServices again, it should just callback right away because it's already connected
                    app.connectToServices(done);
                }
            }

            app.once('ready', () => {
                gotReady = true;
                checkDone();
            });

            app._connecting.should.be.exactly(false);

            // Start the app up
            app.connectToServices(() => {

                // Ready should be done
                app.ready.should.be.exactly(true);

                gotCallback = true;
                checkDone();
            });

        });

        it('should start services and not duplicate connection attempts if started multiple times', done => {

            const app = new OkanjoApp(sharedConfig);
            let gotReady = false,
                gotCallback1 = false,
                gotCallback2 = false;

            function checkDone() {
                if (gotReady && gotCallback1 && gotCallback2) {
                    // If we call connectToServices again, it should just callback right away because it's already connected
                    app.connectToServices(done);
                }
            }

            // Register a fake service connection
            app.registerServiceConnector(cb => {
                // Delay until the next event loop
                setTimeout(cb, 100);
            });

            app.once('ready', () => {
                gotReady = true;
                checkDone();
            });

            app._connecting.should.be.exactly(false);

            // Start the app up
            app.connectToServices(() => {

                // Ready should be done
                app.ready.should.be.exactly(true);

                gotCallback1 = true;
                checkDone();
            });

            app._connecting.should.be.exactly(true);

            // Start the app up again
            app.connectToServices(() => {

                // Ready should be done
                app.ready.should.be.exactly(true);

                gotCallback2 = true;
                checkDone();
            });

        });

    });

});