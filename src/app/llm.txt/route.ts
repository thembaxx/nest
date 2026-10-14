import { llmsResponse } from "@/lib/llms";
export const dynamic = "force-static";
/** Singular alias; llms.txt is the conventional discovery filename. */
export function GET() {
  return llmsResponse();
}
