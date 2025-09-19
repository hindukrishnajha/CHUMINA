"use strict";

module.exports = function (defaultFuncs, api, ctx) {
  return function addUserToGroup(userID, threadID, callback) {
    let resolveFunc = function () {};
    let rejectFunc = function () {};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback && (typeof threadID === "function")) {
      throw new Error("please pass a threadID as a second argument.");
    }

    if (!callback) {
      callback = function (err) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc();
      };
    }

    if (typeof threadID !== "number" && typeof threadID !== "string") {
      throw new Error("ThreadID should be of type Number or String.");
    }

    if (!Array.isArray(userID)) {
      userID = [userID];
    }

    const messageAndOTID = Date.now() + Math.floor(Math.random() * 1000000);
    const form = {
      client: "mercury",
      action_type: "ma-type:log-message",
      author: "fbid:" + ctx.userID,
      thread_id: "",
      timestamp: Date.now(),
      timestamp_absolute: "Today",
      timestamp_relative: new Date().toTimeString().split(' ')[0],
      timestamp_time_passed: "0",
      is_unread: false,
      is_cleared: false,
      is_forward: false,
      is_filtered_content: false,
      is_filtered_content_bh: false,
      is_filtered_content_account: false,
      is_spoof_warning: false,
      source: "source:chat:web",
      "source_tags[0]": "source:chat",
      log_message_type: "log:subscribe",
      status: "0",
      offline_threading_id: messageAndOTID,
      message_id: messageAndOTID,
      threading_id: `<${Date.now()}:${Math.floor(Math.random() * 1000000)}-${ctx.clientID || 'default'}>`,
      manual_retry_cnt: "0",
      thread_fbid: threadID,
    };

    userID.forEach((id, i) => {
      if (typeof id !== "number" && typeof id !== "string") {
        throw new Error("Elements of userID should be of type Number or String.");
      }
      form[`log_message_data[added_participants][${i}]`] = "fbid:" + id;
    });

    defaultFuncs.post("https://www.facebook.com/messaging/send/", ctx.jar, form)
      .then(function (res) {
        if (!res || res.error) {
          throw new Error("Add to group failed.");
        }
        return callback();
      })
      .catch(function (err) {
        console.error("[addUserToGroup] Error:", err.message || JSON.stringify(err));
        return callback(err);
      });

    return returnPromise;
  };
};
