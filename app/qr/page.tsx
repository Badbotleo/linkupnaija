import Logo from "@/components/Logo";
import QrCode from "@/components/qr/QrCode";
import { SITE_ORIGIN } from "@/lib/qr";

export const metadata = {
  title: "QR Code",
  description:
    "Scan to discover events near you on LinkUpNaija. Download a high-resolution QR code for flyers, posters and business cards.",
};

export default function QrPage() {
  return (
    <div className="container-page flex flex-col items-center py-16 text-center">
      <Logo size={40} textClassName="text-xl" />

      <h1 className="mt-8 text-3xl font-extrabold text-gray-900">
        Scan to discover events near you
      </h1>
      <p className="mt-2 max-w-md text-gray-600">
        Print this on flyers, posters or business cards to bring people to
        LinkUpNaija. The download is high-resolution (1000×1000), perfect for
        print.
      </p>

      <div className="mt-10">
        <QrCode
          value={SITE_ORIGIN}
          caption="Scan to discover events near you"
          fileName="linkupnaija-qr"
          displaySize={280}
          exportSize={1000}
          copyValue={SITE_ORIGIN}
        />
      </div>
    </div>
  );
}
