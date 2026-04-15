import { ImageResponse } from "next/og";
import { WyjazdoMarkOg } from "@/components/brand/WyjazdoMarkOg";

export const runtime = "edge";

export const size = { width: 180, height: 180 };

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1E3A5F",
        }}
      >
        <WyjazdoMarkOg size={140} />
      </div>
    ),
    { ...size },
  );
}
