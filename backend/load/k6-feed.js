import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    feed_reads: { executor: "ramping-arrival-rate", startRate: 5, timeUnit: "1s", preAllocatedVUs: 20, stages: [{ target: 50, duration: "30s" }, { target: 50, duration: "1m" }, { target: 0, duration: "15s" }] },
  },
  thresholds: { http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<500", "p(99)<1000"] },
};

export default function () {
  const response = http.get(`${__ENV.BASE_URL}/api/v1/posts?limit=20`, { headers: { Cookie: __ENV.AUTH_COOKIE } });
  check(response, { "feed is successful": (result) => result.status === 200 }); sleep(0.1);
}
