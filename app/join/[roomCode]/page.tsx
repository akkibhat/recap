import { JoinBoardClient } from "@/components/JoinBoardClient";

export default async function JoinPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <JoinBoardClient roomCode={roomCode} />;
}
