import "./globals.css";
import I18nProvider from "@/i18n/I18nProvider";

export const metadata = {
  title: "HubConnect",
  description: "Shared contact pool for sales & event teams",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
