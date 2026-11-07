import { HostBoardClient } from "@/components/HostBoardClient";

// The host's screen for a board; all the work happens in HostBoardClient.
export default async function HostPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <HostBoardClient boardId={boardId} />;
}
