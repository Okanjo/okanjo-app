const should = require('should');

describe('Our Boom', function() {

    const OkanjoApp = require('../OkanjoApp');

    class Response {

        constructor(data) {
            this.output = data;
            this.statusCode = null;
        }

        code(statusCode) {
            this.statusCode = statusCode;
            return this;
        }
    }

    const FakeResponseToolkit = {
        response: (data) => {
            return new Response(data);
        }
    };

    it('can make a success response', function() {
        const res = OkanjoApp.response.ok({
            test: "string",
            collection: [1, 2, 3]
        });

        res.should.be.an.Object();
        res.statusCode.should.be.equal(200);
        should(res.error).be.null();
        res.data.should.be.an.Object();
        res.data.test.should.be.a.String();
        res.data.collection.should.be.an.Array();
        res.data.collection.length.should.be.equal(3);
    });

    it('can make a success response with the response toolkit', function() {
        const res = OkanjoApp.response.ok({
            test: "string",
            collection: [1, 2, 3]
        }, FakeResponseToolkit);

        res.should.be.an.Object();
        res.statusCode.should.be.equal(200);
        res.output.statusCode.should.be.equal(200);
        should(res.output.error).be.null();
        res.output.data.should.be.an.Object();
        res.output.data.test.should.be.a.String();
        res.output.data.collection.should.be.an.Array();
        res.output.data.collection.length.should.be.equal(3);
    });

    it('can make a created response', function() {
        const res = OkanjoApp.response.created({
            test: "string",
            collection: [1, 2, 3]
        });

        res.should.be.an.Object();
        res.statusCode.should.be.equal(201);
        should(res.error).be.null();
        res.data.should.be.an.Object();
        res.data.test.should.be.a.String();
        res.data.collection.should.be.an.Array();
        res.data.collection.length.should.be.equal(3);
    });

    it('can make a created response with the response toolkit', function() {
        const res = OkanjoApp.response.created({
            test: "string",
            collection: [1, 2, 3]
        }, FakeResponseToolkit);

        res.should.be.an.Object();
        res.statusCode.should.be.equal(201);
        res.output.statusCode.should.be.equal(201);
        should(res.output.error).be.null();
        res.output.data.should.be.an.Object();
        res.output.data.test.should.be.a.String();
        res.output.data.collection.should.be.an.Array();
        res.output.data.collection.length.should.be.equal(3);
    });

    it('can format an object using a closure', function() {
        const original = {
            id: "12345",
            name: "wayne",
            status: "sitting next to kevin",
            pants: true,
            created: new Date(),
            updated: new Date()
        };

        const data = OkanjoApp.response.formatForResponse(original, function (obj) {
            return {
                id: "prefix_" + obj.id,
                name: obj.name,
                status: obj.status,
                injected: true
            };
        });

        data.should.be.an.Object();
        data.should.not.be.an.Array();

        // these fields shoulda copied
        data.id.should.equal("prefix_"+original.id);
        data.name.should.be.a.String();
        data.status.should.be.a.String();

        // this field shoulda been stripped
        should(data.pants).not.be.ok();

        // created and updated should automatically copy over
        data.created.should.be.instanceof(Date);
        data.updated.should.be.instanceof(Date);

        // this property should now exist
        data.injected.should.be.equal(true);
    });

    it('can format an array of objects using a closure', function() {

        const original = [
            {
                id: "12345",
                name: "wayne",
                status: "sitting next to kevin",
                pants: true,
                created: new Date()
            },
            {
                id: "123456",
                name: "matt",
                status: "sitting next to wayne",
                pants: true
            },
            {
                id: "123457",
                name: "dave",
                status: "sitting behind to matt",
                pants: false,
                created: new Date()
            }
        ];

        const data = OkanjoApp.response.formatForResponse(original, function (obj) {
            return {
                id: "prefix_" + obj.id,
                name: obj.name,
                status: obj.status,
                created: obj.created,
                injected: true
            };
        });


        data.should.be.an.Array();
        data.forEach(function(data, idx) {
            data.id.should.equal("prefix_"+original[idx].id);
            data.name.should.be.a.String();
            data.status.should.be.a.String();
            should(data.pants).not.be.ok();
            data.injected.should.be.equal(true);
        });

    });

    it('will format empty values as null', function() {
        let data = OkanjoApp.response.formatForResponse(null, function () {
            return "nope";
        });
        should(data).be.exactly(null);

        data = OkanjoApp.response.formatForResponse(undefined, function() {
            return "nope";
        });
        should(data).be.exactly(null);

        data = OkanjoApp.response.formatForResponse("", function() {
            return "nope";
        });
        should(data).be.exactly(null);

        data = OkanjoApp.response.formatForResponse(0, function() {
            return "nope";
        });
        should(data).be.exactly(null);
    });

    it('is accessible in an OkanjoApp instance', function() {
        const app = new OkanjoApp({});

        app.response.should.be.a.Function();

        const res = app.response.ok({
            test: "string",
            collection: [1, 2, 3]
        });

        res.should.be.an.Object();
        res.statusCode.should.be.equal(200);
        should(res.error).be.null();
        res.data.should.be.an.Object();
        res.data.test.should.be.a.String();
        res.data.collection.should.be.an.Array();
        res.data.collection.length.should.be.equal(3);
    });

});