const should = require('should');
const Cluster = require('cluster');
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

if (Cluster.isMaster) return;

describe('Worker', () => {

    const OkanjoApp = require('../OkanjoApp');

    it('process should have env', () => {
        should(process.env.env).be.a.String().and.not.empty();
    });

    it('instantiates ok', done => {

        const app = new OkanjoApp(sharedConfig);
        app.should.be.an.Object();

        function finish() {

            done();

            process.nextTick(() => {
                process.exit(0);
            });
        }

        if (process.env.mode === "basic") {
            app.currentEnvironment.should.be.equal('default');
            app.reportingContext.environment.should.be.equal('default');
            finish();
        } else if (process.env.mode === "dev") {
            // Check it
            app.currentEnvironment.should.be.equal('dev');
            app.reportingContext.environment.should.be.equal('dev');

            // Check that the config applied correctly
            app.config.connectionString.should.be.equal('dev!');
            app.config.otherSetting.should.be.equal('yup');
            app.config.devOnlySetting.should.be.equal('yuppers');
            app.config.service.url.should.be.equal('http://is.winter.overyet.com');
            finish();
        } else if (process.env.mode === "explode") {
            app._reportUncaughtException(new Error('Fall down go boom with exit'));
        } else {
            throw new Error('Unknown test mode!');
        }

    });

});

