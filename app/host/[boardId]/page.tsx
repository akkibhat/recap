import { HostBoardClient } from "@/components/HostBoardClient";

export default async function HostPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <HostBoardClient boardId={boardId} />;
}
