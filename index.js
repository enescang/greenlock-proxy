class GreenlockProxy {

    maintainerEmail
    rules = []
    proxy
    greenlock

    constructor(opts) {
        this.maintainerEmail = opts.maintainerEmail;
        var staging = opts.staging || false;
        var pkg = require('./package.json');
        var Greenlock = require('@root/greenlock');
        this.greenlock = Greenlock.create({
            packageRoot: __dirname,
            configDir: "../../greenlock.d/",
            packageAgent: pkg.name + '/' + pkg.version,
            maintainerEmail: this.maintainerEmail,
            staging: staging
        });

        this.greenlock.manager
            .defaults({
                agreeToTerms: true,
                subscriberEmail: this.maintainerEmail
            })
    }

    register(domains, targets) {
        if (!Array.isArray(domains)) {
            domains = [domains];
        }
        if (!Array.isArray(targets)) {
            targets = [targets];
        }
        this.rules.push({
            domains: domains,
            targets: targets
        })
    }

    handle_certificate(domains) {
        this.greenlock.add({
            subject: domains[0],
            altnames: domains
        })
    }

    start() {
        require('greenlock-express')
            .init({
                packageRoot: __dirname,
                // contact for security and critical bug notices
                maintainerEmail: this.maintainerEmail,
                // where to look for configuration
                configDir: '../../greenlock.d',
                // whether or not to run at cloudscale
                cluster: false
            })
            // Serves on 80 and 443
            // Get's SSL certificates magically!
            .ready(this.httpsWorker.bind(this));
    }

    httpsWorker(glx) {
        this.proxy = require("http-proxy").createProxyServer({ xfwd: true });
        // catches error events during proxying
        this.proxy.on("error", function (err, req, res) {
            console.error(err);
            res.statusCode = 500;
            res.end();
            return;
        })
        // servers a node app that proxies requests to a localhost
        glx.serveApp(this.serveFcn.bind(this))
    }

    serveFcn(req, res) {
        this.rules.forEach(rule => {
            this.bindTarget(req, res, this.proxy, rule.domains, rule.targets);
        })
    }


    bindTarget(req, res, proxy, domains, targets) {
        if (domains.includes(req.headers.host)) {
            let i = (Math.floor(Math.random() * targets.length));
            proxy.web(req, res, {
                target: targets[i]
            })
        }
    }
}

module.exports = GreenlockProxy;
