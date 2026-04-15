import { ImageResponse } from "next/og";
import { WyjazdoMarkOg } from "@/components/brand/WyjazdoMarkOg";

export const runtime = "edge";

export const alt =
  "Wyjazdo — zapisy, płatności i uczestnicy dla organizatorów wyjazdów i wydarzeń";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

const interBold = fetch(
  "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
).then((res) => res.arrayBuffer());

export default async function Image() {
  const fontData = await interBold;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1E3A5F 0%, #152d4a 45%, #0f2138 100%)",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            maxWidth: 780,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <WyjazdoMarkOg size={112} />
            <span
              style={{
                fontSize: 68,
                fontWeight: 700,
                color: "white",
                letterSpacing: -2,
                fontFamily: "Inter",
              }}
            >
              wyjazdo
            </span>
          </div>
          <p
            style={{
              fontSize: 34,
              color: "rgba(255,255,255,0.9)",
              lineHeight: 1.35,
              margin: 0,
              fontFamily: "Inter",
              fontWeight: 700,
            }}
          >
            Zapisy, płatności i uczestnicy — w jednym miejscu.
          </p>
          <p
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.4,
              margin: 0,
              fontFamily: "Inter",
              fontWeight: 700,
            }}
          >
            Dla organizatorów wyjazdów, retreatów i warsztatów.
          </p>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Inter", data: fontData, weight: 700, style: "normal" }],
    },
  );
}
