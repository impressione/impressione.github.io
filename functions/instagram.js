export function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Get a specific parameter
  const name = url.searchParams.get('name');
  if (
    url.searchParams.get("hub.mode") == "subscribe"
  ) {
    return new Response(url.searchParams.get("hub.challenge"));
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
