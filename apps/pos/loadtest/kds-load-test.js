import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const orderCreateTime = new Trend("order_create_time");
const orderCreateFailRate = new Rate("order_create_fails");
const itemsAddTime = new Trend("items_add_time");
const kdsFetchTime = new Trend("kds_fetch_time");
const totalOrdersCreated = new Counter("total_orders_created");

const itemIds = ["m1", "m2", "m4", "m5", "m6"];
function randomItem() {
  return itemIds[Math.floor(Math.random() * itemIds.length)];
}

function trpcPost(procedure, payload) {
  const url = BASE_URL + "/api/trpc/" + procedure;
  const body = JSON.stringify({ "0": { json: payload } });
  const params = {
    headers: { "Content-Type": "application/json" },
  };
  return http.post(url, body, params);
}

function createOrder() {
  const res = trpcPost("pos.createOrder", {
    orderType: "DINE_IN",
  });
  orderCreateTime.add(res.timings.duration);
  const failed = res.status !== 200;
  orderCreateFailRate.add(failed);
  if (failed) {
    console.log("createOrder failed: " + res.status + " " + res.body);
    return null;
  }
  try {
    var data = JSON.parse(res.body);
    if (data && data.result && data.result.data && data.result.data.id) {
      totalOrdersCreated.add(1);
      return data.result.data.id;
    }
    if (Array.isArray(data) && data[0] && data[0].result && data[0].result.data && data[0].result.data.id) {
      totalOrdersCreated.add(1);
      return data[0].result.data.id;
    }
  } catch (e) {
    console.log("createOrder parse error: " + e);
  }
  return null;
}

function addItemToCart(orderId, itemId) {
  var res = trpcPost("pos.addToCart", {
    orderId: orderId,
    menuItemId: itemId,
    quantity: 1,
  });
  itemsAddTime.add(res.timings.duration);
  return res.status === 200;
}

function fetchKdsOrders() {
  var res = trpcPost("kds.getOrders", {});
  kdsFetchTime.add(res.timings.duration);
  return res.status === 200;
}

export const options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "20s", target: 30 },
    { duration: "10s", target: 50 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    order_create_time: ["p(95)<2000"],
    order_create_fails: ["rate<0.1"],
    items_add_time: ["p(95)<2000"],
    kds_fetch_time: ["p(95)<1000"],
  },
};

export default function () {
  group("Create order with items", function () {
    var orderId = createOrder();
    if (!orderId) {
      sleep(0.5);
      return;
    }
    var itemCount = Math.floor(Math.random() * 4) + 2;
    for (var i = 0; i < itemCount; i++) {
      addItemToCart(orderId, randomItem());
    }
  });

  group("Fetch KDS orders", function () {
    fetchKdsOrders();
  });

  sleep(0.3);
}
