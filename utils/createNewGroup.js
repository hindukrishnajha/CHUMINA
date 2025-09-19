"use strict";

module.exports = function (defaultFuncs, api, ctx) {
  return function createNewGroup(participantIDs, groupTitle, callback) {
    if (typeof groupTitle === "function") {
      callback = groupTitle;
      groupTitle = null;
    }

    if (!Array.isArray(participantIDs)) {
      throw { error: "createNewGroup: participantIDs should be an array." };
    }

    if (participantIDs.length < 2) {
      throw { error: "createNewGroup: participantIDs should have at least 2 IDs." };
    }

    let resolveFunc = function () {};
    let rejectFunc = function () {};
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (!callback) {
      callback = function (err, threadID) {
        if (err) {
          return rejectFunc(err);
        }
        resolveFunc(threadID);
      };
    }

    const pids = participantIDs.map(id => ({ fbid: id }));
    pids.push({ fbid: ctx.userID });

    const form = {
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "MessengerGroupCreateMutation",
      av: ctx.userID,
      doc_id: "577041672419534",
      variables: JSON.stringify({
        input: {
          entry_point: "jewel_new_group",
          actor_id: ctx.userID,
          participants: pids,
          client_mutation_id: Math.round(Math.random() * 1024).toString(),
          thread_settings: {
            name: groupTitle,
            joinable_mode: "PRIVATE",
            thread_image_fbid: null,
          },
        },
      }),
    };

    defaultFuncs.post("https://www.facebook.com/api/graphql/", ctx.jar, form)
      .then(function (res) {
        if (res.error || res.errors) {
          throw res;
        }
        return callback(null, res.data.messenger_group_thread_create.thread.thread_key.thread_fbid);
      })
      .catch(function (err) {
        console.error("[createNewGroup] Error:", err.message || JSON.stringify(err));
        return callback(err);
      });

    return returnPromise;
  };
};
