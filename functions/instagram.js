export function onRequestGet(context) {
  const req = context.request;
  if (
    req.query["hub.mode"] == "subscribe" 
  ) {
    return new Response(req.query["hub.challenge"]);
  } else {
    return new Response("Bad request", { status: 400 });
  }
}

export async function onRequestPost(context) {
  const req = context.request;
  console.log("Instagram request body:");
  console.log(req.body);
  return new Response("OK", { status: 200 });
}
