/* eslint-disable @typescript-eslint/no-unused-vars -- global API */
const commonHeaders = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept-Encoding": "gzip, deflate, br",
};

class HttpClient {
  async getJson(url) {
    const rsp = await fetch(url, {
      method: "GET",
      headers: commonHeaders,
    });

    return this._getJsonResponseBody(rsp);
  }

  async _request(method, url, headers = {}) {
    return fetch(url, { method, headers: { ...commonHeaders, ...headers } });
  }

  async request(url, headers = {}) {
    return this._request("GET", url, headers);
  }

  async head(url) {
    const { Accept: _accept, ...headHeaders } = commonHeaders;
    const rsp = await fetch(url, {
      method: "HEAD",
      headers: headHeaders,
    });

    if (!rsp.ok) {
      throw new Error(
        `HttpClient: request failed with HTTP response code: ${rsp.status}`
      );
    }

    const headers = rsp.headers;

    if (headers == null) {
      throw new Error("HttpClient: head request returned null headers.");
    }

    return headers;
  }

  async _getJsonResponseBody(rsp) {
    if (!rsp.ok) {
      throw new Error(
        `HttpClient: request failed with HTTP response code: ${rsp.status}`
      );
    }

    const json = await rsp.json();

    if (json == null) {
      throw new Error(`HttpClient: request returned no response body.`);
    }

    return json;
  }
}
