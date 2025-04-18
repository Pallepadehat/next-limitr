import { NextResponse } from "next/server";
import { withRateLimit } from "next-limitr";

export const GET = withRateLimit({
  limit: 10,
  windowMs: 60000, // 1 minute
  webhook: {
    url: "https://api.example.com/rate-limit-alert",
    headers: {
      Authorization: "Bearer your-token",
    },
  },
})(async (req) => {
  return new NextResponse(JSON.stringify({ message: "Hello World!" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
