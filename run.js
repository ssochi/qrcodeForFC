var request = require('request');
var fs = require("fs");
var QRCode = require('qrcode')
var gm = require('gm');
var path = require('path');
var images = require('images');
var oss = require('ali-oss').Wrapper;
var co = require('co');
var fnv = require('fnv-plus');
var defer=require('q').defer();
var Q = require('q');

function mkQrcode(path,tarUrl,callback) {
        QRCode.toFile(path, tarUrl, {
            color: {
                dark: '#000000',
                light: '#0000'
            }
        }, function (err) {
            if (err) throw  err
            console.log('saved.')
            callback('saved.')
        })
}
function  downloadImg(path,url,callback) {
        //采用request模块，向服务器发起一次请求，获取图片资源
        request.head(url,function(err,res,body){
            if(err){
                throw err
            }
            request(url).pipe(fs.createWriteStream( path)).on('close',function(){
                callback('download done')
            })
        });
}
function addWaterMark(qrPath,imgPath,callback) {
        console.log('addWaterMark...')
        var sourceImg = images(imgPath);
// 比如放置在右下角，先获取原图的尺寸和水印图片尺寸
        var sWidth = sourceImg.width();
        var sHeight = sourceImg.height();
        var watermarkImg = images(qrPath).resize(sourceImg.width()/5);
        var wmWidth = watermarkImg.width();
        var wmHeight = watermarkImg.height();
        images(sourceImg)
        // 设置绘制的坐标位置，右下角距离 40px
            .draw(watermarkImg, sWidth - wmWidth - 0, sHeight - wmHeight - 0)
            // 保存格式会自动识别
            .save('/tmp/saveimg.jpg');
        callback("addWaterMark done")
}
module.exports.handler = function(event, context, callback) {
    console.log("event --> "+event.toString());
    event=JSON.parse(event)
    var imgUrl=event.queryParameters.imgUrl
    var tarUrl=event.queryParameters.tarUrl
    var nocahe = event.queryParameters.nocache
    var qrPath='/tmp/qrcode.jpg'
    var imgPath='/tmp/img.jpg'
    var response500 = {
        isBase64Encoded:false,
        statusCode:500,
        headers: {
            "x-custom-header" : "header value",
        },
        body: null
    };
    var rePath=fnv.hash(imgUrl+tarUrl,64).str()+'.jpg';
    var ossRegion = "oss-" + "cn-shanghai";
    var client = new oss({
        region: ossRegion,
        accessKeyId: 'LTAIregA6tNVCpbl',
        accessKeySecret: 'I9aSDnrkhGyY1JzdZMFj0UB4lnphCB',
    });
    console.log("ossClient has been created successful:" );
    client.useBucket('test-what');
    co(function* () {
        var result = yield client.list({
            prefix: 'qr/'+rePath
        });
        if(nocahe!=false&&result.objects!=undefined){
            console.log('target have cache');
            var response = {
                isBase64Encoded:false,
                statusCode:303,
                headers: {
                    "x-custom-header" : "header value",
                    "Location": 'http://test-what.oss-cn-shanghai.aliyuncs.com/'+ 'qr/'+rePath,
                },
                body: null
            };
            callback(null,response);
        }else {
            console.log('target have not cache');
            try {
                var target='qr/'+rePath
                var tmpFile='/tmp/saveimg.jpg'
                downloadImg(imgPath,imgUrl,function (back) {
                    console.log('downloadImg callback -->'+back)
                    mkQrcode(qrPath,tarUrl,function (back) {
                        console.log('mkQrcode callback -->'+back)
                        addWaterMark(qrPath,imgPath,function (back) {
                            console.log('addWaterMark callback -->'+back)
                            client.put(target, tmpFile).then(function (val) {
                                console.log('Put object:', val);
                                var response = {
                                    isBase64Encoded:false,
                                    statusCode:303,
                                    headers: {
                                        "x-custom-header" : "header value",
                                        "Location": 'http://test-what.oss-cn-shanghai.aliyuncs.com/'+ 'qr/'+rePath,
                                    },
                                    body: null
                                };
                                callback(null,response);
                                return;
                            }).catch(function (err) {
                                console.error('Failed to put object: %j', err);
                                callback(null,response500)
                                return;
                            });
                        })
                    })
                })
            }catch (err) {
                console.log(err)
                callback(null,response500)
            }
        }
        return;
    }).catch(function (err) {
        callback(null,response500);
    });
};
//downloadImg('img.jpg','http://www.orf.cc/upload_files/qb_news_/72/201606/1_kxw9j__.jpg')
// addWaterMark('qrcode.jpg','img.jpg')
var event = {
    queryParameters:{
        imgUrl:'http://attach2.scimg.cn/forum/201410/07/232336qwyo6q86ryxzoerq.jpg',
        tarUrl:'http://www.bybutter.com/',
        nocache:false
    }
}
var content={}
event=JSON.stringify(event)
module.exports.handler(event,content,function (back) {
    console.log(back)
})