import { LibraryProvider } from "@/components/library-provider";
import { NestApp } from "@/components/nest-app";
export default function Home() {
  return (
    <LibraryProvider>
      <NestApp />
    </LibraryProvider>
  );
}
