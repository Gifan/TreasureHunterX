"use strict";
cc._RF.push(module, '8264fty40hF5JqzW/+5pWHu', 'WechatGameLogin');
// scripts/WechatGameLogin.js

"use strict";

var i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field
cc.Class({
  extends: cc.Component,

  properties: {
    cavasNode: {
      default: null,
      type: cc.Node
    },
    backgroundNode: {
      default: null,
      type: cc.Node
    },
    loadingPrefab: {
      default: null,
      type: cc.Prefab
    },
    tipsLabel: {
      default: null,
      type: cc.Label
    }
  },

  // LIFE-CYCLE CALLBACKS:

  onLoad: function onLoad() {

    wx.onHide(function (res) {
      // Reference https://developers.weixin.qq.com/minigame/dev/api/wx.exitMiniProgram.html.
      console.log("+++++ wx onHide(), mapIns.counter: ", window.mapIns.counter, "onHide.res: ", res);
      if ("close" == res.mode) {
        if (window.mapIns) {
          window.mapIns.clearLocalStorageAndBackToLoginScene();
        }
      } else {
        // Deliberately left blank.
      }
    });

    var self = this;
    self.getRetCodeList();
    self.getRegexList();

    cc.loader.loadRes("pbfiles/room_downsync_frame", function (err, textAsset /* cc.TextAsset */) {
      if (err) {
        console.error(err);
        return;
      }

      self.showTips("自动登录中");
      self.checkIntAuthTokenExpire().then(function () {
        self.showTips("   自动登录中...");
        var intAuthToken = JSON.parse(cc.sys.localStorage.getItem('selfPlayer')).intAuthToken;
        self.useTokenLogin(intAuthToken);
      }, function () {
        // 调用wx.login然后请求登录。
        wx.authorize({
          scope: "scope.userInfo",
          success: function success() {
            self.showTips("授权成功, 登录中...");
            wx.login({
              success: function success(res) {
                console.log("wx login success, res: ", res);
                var code = res.code;

                wx.getUserInfo({
                  success: function success(res) {
                    var userInfo = res.userInfo;
                    console.log("Get user info ok: ", userInfo);
                    self.useWxCodeMiniGameLogin(code, userInfo);
                  },
                  fail: function fail(err) {
                    console.error("wx.getUserInfo失败, 已获取权限, 可能由于网络原因获取失败: ", err);
                    self.showTips('点击屏幕授权后登录');
                    self.createAuthorizeThenLoginButton();
                  }
                });
              },
              fail: function fail(err) {
                if (err) {
                  console.error("wx.login失败, 已获取权限, 可能由于网络原因获取失败: ", err);
                  self.showTips('点击屏幕授权后登录');
                  self.createAuthorizeThenLoginButton();
                }
              }
            });
          },
          fail: function fail() {
            //授权失败, 创建授权按钮
            console.warn('授权失败, 创建授权按钮');
            self.showTips('点击屏幕授权后登录');
            self.createAuthorizeThenLoginButton();
          }
        });
      });
    });
  },
  createAuthorizeThenLoginButton: function createAuthorizeThenLoginButton(tips) {
    var self = this;

    var sysInfo = wx.getSystemInfoSync();
    //获取微信界面大小
    var width = sysInfo.screenWidth;
    var height = sysInfo.screenHeight;

    var button = wx.createUserInfoButton({
      type: 'text',
      text: '',
      style: {
        left: 0,
        top: 0,
        width: width,
        height: height,
        backgroundColor: '#00000000', //最后两位为透明度
        color: '#ffffff',
        fontSize: 20,
        textAlign: "center",
        lineHeight: height
      }
    });
    button.onTap(function (res) {
      console.log(res);
      if (null != res.userInfo) {
        var userInfo = res.userInfo;
        self.showTips('授权成功, 登录中...');

        wx.login({
          success: function success(res) {
            console.log('wx.login success, res:');
            console.log(res);
            var code = res.code;
            self.useWxCodeMiniGameLogin(code, userInfo);
            //完全登录成功后删除按钮
            button.destroy();
          },
          fail: function fail(err) {
            if (err) {
              self.showTips('微信登录失败, 点击屏幕重试');
            }
          }
        });
      } else {
        self.showTips('请先授权');
      }
    });
  },
  onDestroy: function onDestroy() {
    if (window.mapIns) {
      console.log("+++++++ WechatGameLogin onDestroy(), mapIns.counter: " + window.mapIns.counter);
    } else {
      console.log("+++++++ WechatGameLogin onDestroy(), mapIns.counter: 0");
    }
  },
  showTips: function showTips(text) {
    if (this.tipsLabel != null) {
      this.tipsLabel.string = text;
    } else {
      console.log('Login scene showTips failed');
    }
  },
  getRetCodeList: function getRetCodeList() {
    var self = this;
    self.retCodeDict = constants.RET_CODE;
  },
  getRegexList: function getRegexList() {
    var self = this;
    self.regexList = {
      EMAIL: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      PHONE: /^\+?[0-9]{8,14}$/,
      STREET_META: /^.{5,100}$/,
      LNG_LAT_TEXT: /^[0-9]+(\.[0-9]{4,6})$/,
      SEO_KEYWORD: /^.{2,50}$/,
      PASSWORD: /^.{6,50}$/,
      SMS_CAPTCHA_CODE: /^[0-9]{4}$/,
      ADMIN_HANDLE: /^.{4,50}$/
    };
  },
  onSMSCaptchaGetButtonClicked: function onSMSCaptchaGetButtonClicked(evt) {
    var timerEnable = true;
    var self = this;
    if (!self.checkPhoneNumber('getCaptcha')) {
      return;
    }
    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.SMS_CAPTCHA + constants.ROUTE_PATH.GET,
      type: 'GET',
      data: {
        phoneCountryCode: self.phoneCountryCodeInput.getComponent(cc.EditBox).string,
        phoneNum: self.phoneNumberInput.getComponent(cc.EditBox).string
      },
      success: function success(res) {
        switch (res.ret) {
          case self.retCodeDict.OK:
            self.phoneNumberTips.getComponent(cc.Label).string = '';
            self.captchaTips.getComponent(cc.Label).string = '';
            break;
          case self.retCodeDict.DUPLICATED:
            self.phoneNumberTips.getComponent(cc.Label).string = constants.ALERT.TIP_LABEL.LOG_OUT;
            break;
          case self.retCodeDict.INCORRECT_PHONE_COUNTRY_CODE_OR_NUMBER:
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.PHONE_ERR");
            break;
          case self.retCodeDict.IS_TEST_ACC:
            self.smsLoginCaptchaInput.getComponent(cc.EditBox).string = res.smsLoginCaptcha;
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.TEST_USER");
            timerEnable = false;
            // clearInterval(self.countdownTimer);
            break;
          case self.retCodeDict.SMS_CAPTCHA_REQUESTED_TOO_FREQUENTLY:
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_FREEQUENT_REQUIRE");
          default:
            break;
        }
        if (timerEnable) self.countdownTime(self);
      }
    });
  },
  countdownTime: function countdownTime(self) {
    self.smsLoginCaptchaButton.off('click', self.onSMSCaptchaGetButtonClicked);
    self.smsLoginCaptchaButton.removeChild(self.smsGetCaptchaNode);
    self.smsWaitCountdownNode.parent = self.smsLoginCaptchaButton;
    var total = 20; // Magic number
    self.countdownTimer = setInterval(function () {
      if (total === 0) {
        self.smsWaitCountdownNode.parent.removeChild(self.smsWaitCountdownNode);
        self.smsGetCaptchaNode.parent = self.smsLoginCaptchaButton;
        self.smsWaitCountdownNode.getChildByName('WaitTimeLabel').getComponent(cc.Label).string = 20;
        self.smsLoginCaptchaButton.on('click', self.onSMSCaptchaGetButtonClicked);
        clearInterval(self.countdownTimer);
      } else {
        total--;
        self.smsWaitCountdownNode.getChildByName('WaitTimeLabel').getComponent(cc.Label).string = total;
      }
    }, 1000);
  },
  checkIntAuthTokenExpire: function checkIntAuthTokenExpire() {
    return new Promise(function (resolve, reject) {
      if (!cc.sys.localStorage.getItem("selfPlayer")) {
        reject();
        return;
      }
      var selfPlayer = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
      selfPlayer.intAuthToken && new Date().getTime() < selfPlayer.expiresAt ? resolve() : reject();
    });
  },
  checkPhoneNumber: function checkPhoneNumber(type) {
    var self = this;
    var phoneNumberRegexp = self.regexList.PHONE;
    var phoneNumberString = self.phoneNumberInput.getComponent(cc.EditBox).string;
    if (phoneNumberString) {
      return true;
      if (!phoneNumberRegexp.test(phoneNumberString)) {
        self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.PHONE_ERR");
        return false;
      } else {
        return true;
      }
    } else {
      if (type === 'getCaptcha' || type === 'login') {
        self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.PHONE_ERR");
      }
      return false;
    }
  },
  checkCaptcha: function checkCaptcha(type) {
    var self = this;
    var captchaRegexp = self.regexList.SMS_CAPTCHA_CODE;
    var captchaString = self.smsLoginCaptchaInput.getComponent(cc.EditBox).string;

    if (captchaString) {
      if (self.smsLoginCaptchaInput.getComponent(cc.EditBox).string.length !== 4 || !captchaRegexp.test(captchaString)) {
        self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.CAPTCHA_ERR");
        return false;
      } else {
        return true;
      }
    } else {
      if (type === 'login') {
        self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.CAPTCHA_ERR");
      }
      return false;
    }
  },
  useTokenLogin: function useTokenLogin(_intAuthToken) {
    var self = this;
    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.INT_AUTH_TOKEN + constants.ROUTE_PATH.LOGIN,
      type: "POST",
      data: {
        intAuthToken: _intAuthToken
      },
      success: function success(resp) {
        self.onLoggedIn(resp);
      },
      error: function error(xhr, status, errMsg) {
        console.log("Login attempt `useTokenLogin` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();

        self.showTips('使用token登录失败, 点击屏幕重试');
        self.createAuthorizeThenLoginButton();
      },
      timeout: function timeout() {
        self.enableInteractiveControls(true);
      }
    });
  },
  enableInteractiveControls: function enableInteractiveControls(enabled) {},
  onLoginButtonClicked: function onLoginButtonClicked(evt) {
    var self = this;
    if (!self.checkPhoneNumber('login') || !self.checkCaptcha('login')) {
      return;
    }
    self.loginParams = {
      phoneCountryCode: self.phoneCountryCodeInput.getComponent(cc.EditBox).string,
      phoneNum: self.phoneNumberInput.getComponent(cc.EditBox).string,
      smsLoginCaptcha: self.smsLoginCaptchaInput.getComponent(cc.EditBox).string
    };
    self.enableInteractiveControls(false);

    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.SMS_CAPTCHA + constants.ROUTE_PATH.LOGIN,
      type: "POST",
      data: self.loginParams,
      success: function success(resp) {
        self.onLoggedIn(resp);
      },
      error: function error(xhr, status, errMsg) {
        console.log("Login attempt `onLoginButtonClicked` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
      },
      timeout: function timeout() {
        self.enableInteractiveControls(true);
      }
    });
  },
  onWechatLoggedIn: function onWechatLoggedIn(res) {
    var self = this;
    if (res.ret === self.retCodeDict.OK) {
      //根据服务器返回信息设置selfPlayer
      self.enableInteractiveControls(false);
      var date = Number(res.expiresAt);
      var selfPlayer = {
        expiresAt: date,
        playerId: res.playerId,
        intAuthToken: res.intAuthToken,
        displayName: res.displayName,
        avatar: res.avatar
      };
      cc.sys.localStorage.setItem('selfPlayer', JSON.stringify(selfPlayer));

      self.useTokenLogin(res.intAuthToken);
    } else {
      cc.sys.localStorage.removeItem("selfPlayer");
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
      self.showTips(constants.ALERT.TIP_LABEL.WECHAT_LOGIN_FAILS + ", errorCode = " + res.ret);

      self.showTips('登录失败, 请点击屏幕重试');
      self.createAuthorizeThenLoginButton();
    }
  },
  onLoggedIn: function onLoggedIn(res) {
    var self = this;
    console.log("OnLoggedIn: ", res);
    if (res.ret === self.retCodeDict.OK) {
      if (window.isUsingX5BlinkKernelOrWebkitWeChatKernel()) {
        window.initWxSdk = self.initWxSdk.bind(self);
        window.initWxSdk();
      }
      self.enableInteractiveControls(false);
      var date = Number(res.expiresAt);
      var selfPlayer = {
        expiresAt: date,
        playerId: res.playerId,
        intAuthToken: res.intAuthToken,
        avatar: res.avatar,
        displayName: res.displayName,
        name: res.name
      };
      cc.sys.localStorage.setItem("selfPlayer", JSON.stringify(selfPlayer));
      console.log("cc.sys.localStorage.selfPlayer = ", cc.sys.localStorage.getItem("selfPlayer"));
      if (self.countdownTimer) {
        clearInterval(self.countdownTimer);
      }

      cc.director.loadScene('default_map');
    } else {
      console.warn('onLoggedIn failed!');
      cc.sys.localStorage.removeItem("selfPlayer");
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
      self.enableInteractiveControls(true);
      switch (res.ret) {
        case self.retCodeDict.DUPLICATED:
          this.phoneNumberTips.getComponent(cc.Label).string = constants.ALERT.TIP_LABEL.LOG_OUT;
          break;
        case this.retCodeDict.TOKEN_EXPIRED:
          this.captchaTips.getComponent(cc.Label).string = constants.ALERT.TIP_LABEL.TOKEN_EXPIRED;
          break;
        case this.retCodeDict.SMS_CAPTCHA_NOT_MATCH:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case this.retCodeDict.INCORRECT_CAPTCHA:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case this.retCodeDict.SMS_CAPTCHA_CODE_NOT_EXISTING:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case this.retCodeDict.INCORRECT_PHONE_NUMBER:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.INCORRECT_PHONE_NUMBER");
          break;
        case this.retCodeDict.INVALID_REQUEST_PARAM:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.INCORRECT_PHONE_NUMBER");
          break;
        case this.retCodeDict.INCORRECT_PHONE_COUNTRY_CODE:
          this.captchaTips.getComponent(cc.Label).string = constants.ALERT.TIP_LABEL.INCORRECT_PHONE_COUNTRY_CODE;
          break;
        default:
          break;
      }

      self.showTips('登录失败, 点击屏幕重试');
      self.createAuthorizeThenLoginButton();
    }
  },
  useWXCodeLogin: function useWXCodeLogin(_code) {
    var self = this;
    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.WECHAT + constants.ROUTE_PATH.LOGIN,
      type: "POST",
      data: {
        code: _code
      },
      success: function success(res) {
        self.onWechatLoggedIn(res);
      },
      error: function error(xhr, status, errMsg) {
        console.log("Login attempt `onLoginButtonClicked` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        cc.sys.localStorage.removeItem("selfPlayer");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
        self.showTips(constants.ALERT.TIP_LABEL.WECHAT_LOGIN_FAILS + ", errorMsg =" + errMsg);
      }
    });
  },


  //对比useWxCodeLogin函数只是请求了不同url
  useWxCodeMiniGameLogin: function useWxCodeMiniGameLogin(_code, _userInfo) {
    var self = this;
    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.WECHATGAME + constants.ROUTE_PATH.LOGIN,
      type: "POST",
      data: {
        code: _code,
        avatarUrl: _userInfo.avatarUrl,
        nickName: _userInfo.nickName
      },
      success: function success(res) {
        self.onWechatLoggedIn(res);
      },
      error: function error(xhr, status, errMsg) {
        console.log("Login attempt `onLoginButtonClicked` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        cc.sys.localStorage.removeItem("selfPlayer");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
        self.showTips(constants.ALERT.TIP_LABEL.WECHAT_LOGIN_FAILS + ", errorMsg =" + errMsg);

        self.showTips('登录失败, 点击屏幕重试');
        self.createAuthorizeThenLoginButton();
      }
    });
  },
  getWechatCode: function getWechatCode(evt) {
    var self = this;
    self.showTips("");
    var wechatServerEndpoint = wechatAddress.PROTOCOL + "://" + wechatAddress.HOST + (null != wechatAddress.PORT && "" != wechatAddress.PORT.trim() ? ":" + wechatAddress.PORT : "");
    var url = wechatServerEndpoint + constants.WECHAT.AUTHORIZE_PATH + "?" + wechatAddress.APPID_LITERAL + "&" + constants.WECHAT.REDIRECT_RUI_KEY + NetworkUtils.encode(window.location.href) + "&" + constants.WECHAT.RESPONSE_TYPE + "&" + constants.WECHAT.SCOPE + constants.WECHAT.FIN;
    console.log("To visit wechat auth addr: ", url);
    window.location.href = url;
  },
  initWxSdk: function initWxSdk() {
    var selfPlayer = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
    var origUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    /*
    * The `shareLink` must 
    * - have its 2nd-order-domain registered as trusted 2nd-order under the targetd `res.jsConfig.app_id`, and
    * - extracted from current window.location.href.   
    */
    var shareLink = origUrl;
    var updateAppMsgShareDataObj = {
      type: 'link', // 分享类型,music、video或link，不填默认为link
      dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
      title: document.title, // 分享标题
      desc: 'Let\'s play together!', // 分享描述
      link: shareLink + (cc.sys.localStorage.getItem('boundRoomId') ? "" : "?expectedRoomId=" + cc.sys.localStorage.getItem('boundRoomId')),
      imgUrl: origUrl + "/favicon.ico", // 分享图标
      success: function success() {
        // 设置成功
      }
    };
    var menuShareTimelineObj = {
      title: document.title, // 分享标题
      link: shareLink + (cc.sys.localStorage.getItem('boundRoomId') ? "" : "?expectedRoomId=" + cc.sys.localStorage.getItem('boundRoomId')),
      imgUrl: origUrl + "/favicon.ico", // 分享图标
      success: function success() {}
    };

    var wxConfigUrl = window.isUsingWebkitWechatKernel() ? window.atFirstLocationHref : window.location.href;

    //接入微信登录接口
    NetworkUtils.ajax({
      "url": backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.WECHAT + constants.ROUTE_PATH.JSCONFIG,
      type: "POST",
      data: {
        "url": wxConfigUrl,
        "intAuthToken": selfPlayer.intAuthToken
      },
      success: function success(res) {
        if (constants.RET_CODE.OK != res.ret) {
          console.warn("Failed to get `wsConfig`: ", res);
          return;
        }
        var jsConfig = res.jsConfig;
        var configData = {
          debug: CC_DEBUG, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
          appId: jsConfig.app_id, // 必填，公众号的唯一标识
          timestamp: jsConfig.timestamp.toString(), // 必填，生成签名的时间戳
          nonceStr: jsConfig.nonce_str, // 必填，生成签名的随机串
          jsApiList: ['onMenuShareAppMessage', 'onMenuShareTimeline'],
          signature: jsConfig.signature // 必填，签名
        };
        console.log("config url: ", wxConfigUrl);
        console.log("wx.config: ", configData);
        wx.config(configData);
        console.log("Current window.location.href: ", window.location.href);
        wx.ready(function () {
          console.log("Here is wx.ready.");
          wx.onMenuShareAppMessage(updateAppMsgShareDataObj);
          wx.onMenuShareTimeline(menuShareTimelineObj);
        });
        wx.error(function (res) {
          console.error("wx config fails and error is ", JSON.stringify(res));
        });
      },
      error: function error(xhr, status, errMsg) {
        console.error("Failed to get `wsConfig`: ", errMsg);
      }
    });
  }
});

cc._RF.pop();