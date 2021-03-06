﻿'use strict';
var http = require('http');
var request = require('request');
var express = require('express');
const aws = require('aws-sdk');
const puppeteer = require('puppeteer');
const moment = require('moment');
var router = express.Router();
var fs = require('fs');
const redirect_uri = encodeURIComponent('https://discordbottrades.herokuapp.com');
const mainChannelID = '730906578789859338';
const detailsFileName = '../details.json';
var passport = require('passport');
var bcrypt = require('bcryptjs');
require('dotenv').config();
const Discord = require('discord.js');
//Signals Bot
const client = new Discord.Client();
var async = require('async');
//On Discord Error
client.on('error', err => {
    console.log(err);
});
exports.client = client;
//Kick cancelled students
client.on('ready', () => {
    exports.client = client;
});
client.login(process.env.DISCORDTOKEN);
//Trading Client
const tradingclient = new Discord.Client();
//On Discord Error
tradingclient.on('error', err => {
    console.log(err);
});
exports.tradingclient = tradingclient;
//Kick cancelled students
tradingclient.on('ready', () => {
    exports.tradingclient = tradingclient;
});
tradingclient.login(process.env.DISCORDTRADINGTOKEN);
//Trading Bot
//Relay messages from Discord and post to them a forum ticker automatically if it contains ($)
tradingclient.on('message', function (message) {
    if (message.content === 'bothelp') {
        message.channel.send("Bot message format for Stocks : (SHARES) BUY/SELL +QUANTITY/-QUANTITY SYMBOL @ PRICE/MKT");
        message.channel.send("Stocks Example : (SHARES) BUY +1 GT @ 9.55");
        message.channel.send("Bot message format for Options : (OPTIONS) BUY/SELL +QUANTITY/-QUANTITY SYMBOL MONTH DAY YEAR STRIKE Call/Put @ PRICE/MKT");
        message.channel.send("Options Example : (OPTIONS) BUY +1 SPY AUG 24 2020 346.0 Call @ 0.02");
        message.channel.send("To cancel last order : !clo");
    }
    //Cancel Order
    if (message.content.includes('!clo')) {
        if (!message.author.bot) {
            userModel.getByDiscordId(message.author.id, function (err, user) {
                //Get Account ID
                var placeorder_req = {
                    url: 'https://api.tdameritrade.com/v1/accounts',
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Bearer ' + user.accesstoken
                    }
                };
                //Get Account ID
                request(placeorder_req, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        body = JSON.parse(body);
                        var accountId = body[0]['securitiesAccount']['accountId'];
                        //Get last order
                        var placeorder_req = {
                            url: 'https://api.tdameritrade.com/v1/orders?accountId='+accountId+'',
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Authorization': 'Bearer ' + user.accesstoken
                            }
                        };
                        request(placeorder_req, function (error, response, body) {
                            body = JSON.parse(body);
                            //Cancel order
                            //Get last order
                            for (var b in body) {
                                console.log(b);
                                console.log(body[b]);
                                var placeorder_req = {
                                    url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders/' + body[b].orderId,
                                    method: 'DELETE',
                                    headers: {
                                        'Content-Type': 'application/x-www-form-urlencoded',
                                        'Authorization': 'Bearer ' + user.accesstoken
                                    }
                                };
                                request(placeorder_req, function (error, response, body) {
                                    console.log(body);
                                });
                            }
                        });
                    }
                });
            })
        }
    }
    //Submit order
    if (message.content.includes('(SHARES) BUY')
        || message.content.includes('(SHARES) SELL')
        || message.content.includes('(OPTIONS) BUY')
        || message.content.includes('(OPTIONS) SELL')) {
        if (!message.author.bot) {
            userModel.getByDiscordId(message.author.id, function (err, user) {
                if (user && user.discordTradeUserID) {
                    //message.channel.send(message.content);
                    var split = message.content.split(' ');
                    var type = split[0].toUpperCase();
                    var side = split[1].toUpperCase();
                    var quantity = parseInt(split[2].replace('+', '').replace('-', ''));
                    var symbol = split[3].toUpperCase();
                    var price = 0;
                    var month = 0;
                    var day = 0;
                    var year = 0
                    var strike = 0;
                    var callput = 0;
                    var price = 0;
                    //Stock
                    if (type == "(SHARES)") {
                        price = split[5];
                    }
                    //Options
                    else {
                        month = split[4];
                        day = split[5];
                        year = split[6];
                        strike = parseInt(split[7]);
                        callput = split[8].charAt(0).toUpperCase();
                        price = split[10];
                        symbol = symbol + "_" + moment(month + ' ' + day + ' ' + year).format("MMDDYY") + callput + strike;
                        console.log(month + day + year);
                        console.log(symbol);
                    }

                    var orderObject = {};
                    if (price == "MKT" && type == "(SHARES)") {
                        orderObject = {
                            "orderType": "MARKET",
                            "session": "NORMAL",
                            "duration": "DAY",
                            "orderStrategyType": "SINGLE",
                            "orderLegCollection": [
                                {
                                    "instruction": side,
                                    "quantity": quantity,
                                    "instrument": {
                                        "symbol": symbol,
                                        "assetType": "EQUITY"
                                    }
                                }
                            ]
                        }
                    } else if (price != "MKT" && type == "(SHARES)") {
                        orderObject = {
                            "orderType": "LIMIT",
                            "session": "NORMAL",
                            "price": price,
                            "duration": "DAY",
                            "orderStrategyType": "SINGLE",
                            "orderLegCollection": [
                                {
                                    "instruction": side,
                                    "quantity": quantity,
                                    "instrument": {
                                        "symbol": symbol,
                                        "assetType": "EQUITY"
                                    }
                                }
                            ]
                        }
                    }
                    if (price != "MKT" && type == "(OPTIONS)") {
                        orderObject = {
                            "complexOrderStrategyType": "NONE",
                            "orderType": "LIMIT",
                            "session": "NORMAL",
                            "price": price,
                            "duration": "DAY",
                            "orderStrategyType": "SINGLE",
                            "orderLegCollection": [
                                {
                                    "instruction": side + "_TO_OPEN",
                                    "quantity": quantity,
                                    "instrument": {
                                        "symbol": symbol,
                                        "assetType": "OPTION"
                                    }
                                }
                            ]
                        }
                    }
                    if (price == "MKT" && type == "(OPTIONS)") {
                        orderObject = {
                            "complexOrderStrategyType": "NONE",
                            "orderType": "MARKET",
                            "session": "NORMAL",
                            "duration": "DAY",
                            "orderStrategyType": "SINGLE",
                            "orderLegCollection": [
                                {
                                    "instruction": side + "_TO_OPEN",
                                    "quantity": quantity,
                                    "instrument": {
                                        "symbol": symbol,
                                        "assetType": "OPTION"
                                    }
                                }
                            ]
                        }
                    }
                    //Place Order
                    var placeorder_req = {
                        url: 'https://api.tdameritrade.com/v1/accounts',
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Authorization': 'Bearer ' + user.accesstoken
                        }
                    };
                    request(placeorder_req, function (error, response, body) {
                        if (!error && response.statusCode == 200) {
                            body = JSON.parse(body);
                            var accountId = body[0]['securitiesAccount']['accountId'];
                            console.log(accountId);
                            console.log(orderObject);
                            var placeorder_req = {
                                url: 'https://api.tdameritrade.com/v1/accounts/' + accountId + '/orders',
                                method: 'POST',
                                headers: {
                                    'Authorization': 'Bearer ' + user.accesstoken,
                                    'content-type': 'application/json',
                                    'connection': 'Keep-Alive'
                                },
                                body: orderObject,
                                json: true
                            };
                            request(placeorder_req, function (error, response, body) {
                                console.log(body);
                            });
                        } else {
                            resetAccessToken(user);
                        }
                    });

                }
            });
        }
    }
})

//Models
const licenseKeyModel = require('../models/token');
const userModel = require('../models/user');
const adminModel = require('../models/admin');
//userModel.createSchema(function (err, done) { });
//licenseKeyModel.createSchema(function (err, done) {});
//Login Discord Bot
const S3_BUCKET = process.env.S3_BUCKET_NAME;
aws.config.region = 'us-east-2';
const Days90 = 7776000; // 90 days in seconds
const Minutes30 = 1800 // 30 mins in seconds
const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    signatureVersion: 'v4'
});
// Setting up S3 upload parameters
const params = {
    Bucket: 'tdbot',
    Key: 'details.json' // File name you want to save as in S3
};
var details = [];
// Uploading files to the bucket
s3.getObject(params, function (err, data) {
    if (err) {
        console.log(err);
    }
    try {
        details = JSON.parse(data.Body.toString());
    } catch (err) {
        console.log(err);
    }
});


/*POST for login*/
//Try to login with passport
router.post('/login', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureMessage: 'Invalid Login'
}));

/*Logout*/
router.get('/logout', function (req, res) {
    req.session.destroy(function (err) {
        res.redirect('/');
    });
});

/*GET for login*/
router.get('/login', function (req, res) {
    res.render('login');
});


/*POST for register*/
router.post('/register', function (req, res) {
    //Insert user
    bcrypt.hash(req.body.password, 10, function (err, hash) {
        var registerUser = {
            username: req.body.username,
            password: hash
        }
        //Check if user already exists
        adminModel.create(registerUser, function (err, user) {
            req.login(registerUser, function (err) {
                if (err) console.log(err);
                return res.redirect('/');
            });
        });
    })
});

/* 
Callback endpoint the TDA app uses.
To understand more about how the API authenticates, see this link.
https://developer.tdameritrade.com/content/simple-auth-local-apps
*/
router.get('/auth', function (req, res, next) {
    var authRequest = {
        url: 'https://api.tdameritrade.com/v1/oauth2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
            'grant_type': 'authorization_code',
            'access_type': 'offline',
            'code': req.query.code, // get the code from url
            'client_id': process.env.CLIENT_ID + "@AMER.OAUTHAP", // this client id comes from config vars
            'redirect_uri': 'https://discordbottrades.herokuapp.com/auth'
        }
    };

    // make the post request
    request(authRequest, function (error, response, body) {
        try {
            // parse the tokens
            var authReply = JSON.parse(body);
            if (!error && response.statusCode == 200) {
                var newUser = {
                    accesstoken: authReply.access_token,
                    refreshtoken: authReply.refresh_token,
                    accesslastupdate: moment()
                }
                userModel.create(newUser, authReply.access_token, function (err, done) {
                    if (req.user)
                        res.redirect('/dashboard');
                    else
                        res.redirect('/success');
                });
            } else {
                res.send(authReply);
            }
        } catch (err) {
            console.log(err);
            res.send(authReply);
        }
    });

});


router.get('/success', function (req, res) {
    res.render('success');
});

router.get('/licenseKey', function (req, res) {
    res.render('createLicenseKey');
});

router.post('/generateLicenseKey', function (req, res) {
    function makeid(length) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result.toUpperCase();
    }
    var randKey = makeid(7);
    var licenseKey = {
        key: randKey
    };
    licenseKeyModel.create(licenseKey, function (err, insert) {
        res.send({ 'licenseKey': randKey });
    });
});

router.get('/', function (req, res) {
    if (req.isAuthenticated()) {
        userModel.get(function (err, users) {
            res.render('dashboard', { users: users, user: req.user });
        });
    } else {
        res.redirect('/login');
    }
});

router.get('/dashboard', function (req, res) {
    if (req.isAuthenticated()) {
        userModel.get(function (err, users) {
            console.log(users);
            res.render('dashboard', { users: users, user: req.user });
        });
    } else {
        res.redirect('/login');
    }
});

router.get('/update/:userid', function (req, res) {
    userModel.getById(req.params.userid, function (err, user) {
        res.render('update', { user: user });
    });
});

router.post('/update/:userid', function (req, res) {
    var user = {
        serverID: req.body.serverID,
        channelID: req.body.channelID,
        discordTradeUserID: req.body.userID
    };
    console.log(user);
    userModel.update(user, req.params.userid, function (err, done) {
        res.redirect('/dashboard');
    });
});

router.post('/delete/:userid', function (req, res) {
    userModel.delete(req.params.userid, function (err, done) {
        res.redirect('/dashboard');
    });
});


var lastOrderId = [];
// Setting up S3 upload parameters
const orderparams = {
    Bucket: 'tdbot',
    Key: 'orders.json' // File name you want to save as in S3
};
// Uploading files to the bucket
s3.getObject(orderparams, function (err, data) {
    if (err) {
        console.log(err);
    }
    try {
        lastOrderId = JSON.parse(data.Body.toString());
    } catch (err) {
        console.log(err);
    }
});
//Get open positions
function getOrderUpdates() {
    userModel.get(function (err, details) {
        async.forEachOfSeries(details, function (user, index, inner_callback) {
            var refreshtoken_req = {
                url: 'https://api.tdameritrade.com/v1/orders',
                method: 'GET',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Bearer ' + user.accesstoken
                }
            };
            //Make the request and get positions
            request(refreshtoken_req, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    try {
                        var orders = JSON.parse(body);
                        if (orders.length) {
                            async.forEachOfSeries(orders, function (order, index, inner_callback1) {

                                try {
                                    var messageToDisplay = ''
                                    if (order.status == 'FILLED') {
                                        if (order.price == null || order.price == undefined || order.price == 'undefined')
                                            order.price = 'MARKET';
                                        if (order.orderLegCollection[0].instruction == 'BUY'
                                            || (order.orderLegCollection != null && order.orderLegCollection.length > 0 && order.orderLegCollection[0].positionEffect == 'OPENING')) {
                                            order.orderLegCollection[0].instruction = 'BOT';
                                            if (order.orderLegCollection[0].orderLegType == 'EQUITY')
                                                messageToDisplay = "(SHARES) " + order.orderLegCollection[0].instruction + " +" + order.filledQuantity + " " + order.orderLegCollection[0].instrument.symbol + " @ " + order.price;
                                            else {
                                                console.log(order.orderLegCollection[0].instrument);
                                                messageToDisplay = "(OPTIONS) " + order.orderLegCollection[0].instruction + " +" + order.filledQuantity + " " + order.orderLegCollection[0].instrument.description + " @ " + order.price;

                                            }
                                        }
                                        else {
                                            order.orderLegCollection[0].instruction = 'SOLD';
                                            if (order.orderLegCollection[0].orderLegType == 'EQUITY')
                                                messageToDisplay = "(SHARES) " + order.orderLegCollection[0].instruction + " -" + order.filledQuantity + " " + order.orderLegCollection[0].instrument.symbol + " @ " + order.price;
                                            else {
                                                messageToDisplay = "(OPTIONS) " + order.orderLegCollection[0].instruction + " -" + order.filledQuantity + " " + order.orderLegCollection[0].instrument.description + " @ " + order.price;
                                            }
                                        }
                                        if (!lastOrderId.includes(messageToDisplay + order.orderId.toString())
                                            && moment(order.enteredTime).isAfter(moment(user.accesslastupdate))) {
                                            client.channels.cache.get(user.channelID).send(messageToDisplay);
                                            lastOrderId.push(messageToDisplay + order.orderId.toString());
                                            const s3 = new aws.S3({
                                                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                                                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                                                signatureVersion: 'v4',
                                                region: 'us-east-2'
                                            });
                                            // Setting up S3 upload parameters
                                            const uploadparams = {
                                                Bucket: S3_BUCKET,
                                                Key: 'orders.json', // File name you want to save as in S3
                                                Body: JSON.stringify(lastOrderId, null, 2)
                                            };

                                            // Uploading files to the bucket
                                            s3.upload(uploadparams, function (err, data) {
                                                if (err) {
                                                    console.log(err);
                                                }
                                            });
                                            inner_callback1(null);
                                        } else inner_callback1(null);
                                    } else inner_callback1(null);

                                } catch (err) {
                                    if (err) console.log(err);
                                    inner_callback1(null);
                                }
                            }, function (err) {
                                if (err) console.log(err);
                                inner_callback(null);
                            });
                        } else inner_callback(null);
                    } catch (err) {
                        if (err) console.log(err);
                        inner_callback(null);
                    }
                } else {
                    console.log((body));
                    resetAccessToken(user);
                    inner_callback(null);
                }
            });
        }, function (err) {

        });
    });
}
setInterval(getOrderUpdates, 13000);


function resetAccessToken(user) {
    try {
        var refreshtoken_req = {
            url: 'https://api.tdameritrade.com/v1/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                'grant_type': 'refresh_token',
                'refresh_token': user.refreshtoken,
                'access_type': '',
                'client_id': process.env.CLIENT_ID
            }
        };

        request(refreshtoken_req, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log('Successfully reset access token.');
                // get the TDA response
                var authReply = JSON.parse(body);
                //TODO : Successfully resets access token but next call for order updates does not work with new token even though it was granted
                user.accesstoken = authReply.access_token;
                user.accesslastupdate = Date().toString();

                const s3 = new aws.S3({
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    signatureVersion: 'v4',
                    region: 'us-east-2'
                });
                // Setting up S3 upload parameters
                const params = {
                    Bucket: S3_BUCKET,
                    Key: 'details.json', // File name you want to save as in S3
                    Body: JSON.stringify(details, null, 2)
                };

                // Uploading files to the bucket
                s3.upload(params, function (err, data) {
                    if (err) {
                        console.log(err);
                    }
                });
                user.authStatus = "Authorized";
                userModel.update(user, user.userid, function (err, done) {

                });

            } else {
                console.log('Could not reset access token.');
                console.log(body);
                console.log("Client ID : " + process.env.CLIENT_ID);
                console.log("User ID : " + user.userid);
                user.authStatus = "Not Authorized";
                userModel.update(user, user.userid, function (err, done) {

                });
            }
        });

    } catch (err) {
        console.log(err);
    }

}


/** 
 * returns true if the time difference is more than or equal to the maxDifference
 * maxDifference should be in seconds
*/
function compareTimeDifference(t1, t2, maxDifference) {
    var date1 = new Date(t1);
    var date2 = new Date(t2);
    var diff = Math.floor((date2 - date1) / 1000); // difference in seconds

    return (diff >= maxDifference);
}

/**
 * checks if the access/refresh are valid and if not then 
 * generate new tokens
*/
function validateTokens() {
    let time = Date().toString();
    // if the refresh token is expired, then reset both tokens
    if (compareTimeDifference(details.access_last_update, time, Minutes30)) {
        resetAccessToken();
    }
}

module.exports = router;
