(function(hello) {

	const base = 'https://api.x.com/';

	hello.init({

		twitter: {

			// Ensure that you define an oauth_proxy
			oauth: {
				version: 2,
				auth: 'https://x.com/i/oauth2/authorize',
				grant: 'https://api.x.com/2/oauth2/token',
				response_type: 'code',
				base64_state: true
			},

			// Authorization scopes
			scope: {
				basic: 'users.read',
				friends: 'follows.read',
				publish: 'tweet.write',
				offline_access: 'offline.access'
			},

			scope_delim: '%20',

			login (p) {
				p.qs.code_challenge = 'challenge'; // Let's set this to an offline access to return a refresh_token
				p.qs.code_challenge_method = 'plain';
				p.qs.state.code_verifier = 'challenge';

				// XXX: Delete some state vars to get the resulting b64 encoded string below 500 chars.
				try {
					delete p.qs.state.scope;
					delete p.qs.state.display;
					delete p.qs.state.redirect_url;
					delete p.qs.state.state;
				} catch (e) {}
			},

			base: base + '2/',

			get: {
				me: 'account/verify_credentials.json',
				'me/friends': 'friends/list.json?count=@{limit|200}',
				'me/following': 'friends/list.json?count=@{limit|200}',
				'me/followers': 'followers/list.json?count=@{limit|200}',

				// Https://dev.twitter.com/docs/api/1.1/get/statuses/user_timeline
				'me/share': 'statuses/user_timeline.json?count=@{limit|200}',

				// Https://dev.twitter.com/rest/reference/get/favorites/list
				'me/like': 'favorites/list.json?count=@{limit|200}'
			},

			post: {
				'me/share': function(p, callback) {

					var data = p.data;
					p.data = null;

					var status = [];

					// Change message to status
					if (data.message) {
						status.push(data.message);
						delete data.message;
					}

					// If link is given
					if (data.link) {
						status.push(data.link);
						delete data.link;
					}

					if (data.picture) {
						status.push(data.picture);
						delete data.picture;
					}

					// Compound all the components
					if (status.length) {
						data.status = status.join(' ');
					}

					// Tweet media
					if (data.file) {
						data['media[]'] = data.file;
						delete data.file;
						p.data = data;
						callback('statuses/update_with_media.json');
					}

					// Retweet?
					else if ('id' in data) {
						callback('statuses/retweet/' + data.id + '.json');
					}

					// Tweet
					else {
						// Assign the post body to the query parameters
						hello.utils.extend(p.query, data);
						callback('statuses/update.json?include_entities=1');
					}
				},

				// See: https://dev.twitter.com/rest/reference/post/favorites/create
				'me/like': function(p, callback) {
					var id = p.data.id;
					p.data = null;
					callback('favorites/create.json?id=' + id);
				}
			},

			del: {
				// See: https://dev.twitter.com/rest/reference/post/favorites/destroy
				'me/like': function(p, callback) {
					p.method = 'post';
					var id = p.data.id;
					p.data = null;
					callback('favorites/destroy.json?id=' + id);
				}
			},

			wrap: {
				me (res) {
					formatError(res);
					formatUser(res);
					return res;
				},

				'me/friends': formatFriends,
				'me/followers': formatFriends,
				'me/following': formatFriends,

				'me/share' (res) {
					formatError(res);
					paging(res);
					if (!res.error && 'length' in res) {
						return {data: res};
					}

					return res;
				},

				default (res) {
					res = arrayToDataResponse(res);
					paging(res);
					return res;
				}
			},
			xhr: function(p) {
				if (p.method === 'post') {
					p.headers['Content-Type'] = 'application/x-www-form-urlencoded';
					p.proxy = true;
					return true;
				}
				return false;
			}
		}
	});

	function formatUser(o) {
		if (o.id) {
			if (o.name) {
				var m = o.name.split(' ');
				o.first_name = m.shift();
				o.last_name = m.join(' ');
			}

			// See: https://dev.twitter.com/overview/general/user-profile-images-and-banners
			o.thumbnail = o.profile_image_url_https || o.profile_image_url;
		}

		return o;
	}

	function formatFriends(o) {
		formatError(o);
		paging(o);
		if (o.users) {
			o.data = o.users.map(formatUser);
			delete o.users;
		}

		return o;
	}

	function formatError(o) {
		if (o.errors) {
			var e = o.errors[0];
			o.error = {
				code: 'request_failed',
				message: e.message
			};
		}
	}

	// Take a cursor and add it to the path
	function paging(res) {
		// Does the response include a 'next_cursor_string'
		if ('next_cursor_str' in res) {
			// See: https://dev.twitter.com/docs/misc/cursoring
			res.paging = {
				next: '?cursor=' + res.next_cursor_str
			};
		}
	}

	function arrayToDataResponse(res) {
		return Array.isArray(res) ? {data: res} : res;
	}

	/**
	// The documentation says to define user in the request
	// Although its not actually required.

	var user_id;

	function withUserId(callback){
		if(user_id){
			callback(user_id);
		}
		else{
			hello.api('twitter:/me', function(o){
				user_id = o.id;
				callback(o.id);
			});
		}
	}

	function sign(url){
		return function(p, callback){
			withUserId(function(user_id){
				callback(url+'?user_id='+user_id);
			});
		};
	}
	*/

})(hello);
