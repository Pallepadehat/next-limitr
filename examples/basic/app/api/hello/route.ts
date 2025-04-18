import { withRateLimit } from "next-limitr";
import { NextRequest, NextResponse } from "next/server";

export const GET = withRateLimit({
  limit: 10,
  windowMs: 60000, // 1 minute
  webhook: {
    url: "https://api.example.com/rate-limit-alert",
    headers: {
      Authorization: "Bearer your-token",
    },
  },
})((request: NextRequest) => {
  return NextResponse.json({ message: "Hello World!" });
});
