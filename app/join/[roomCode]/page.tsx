import { JoinBoardClient } from "@/components/JoinBoardClient";

// The guest's screen for a board, reached by room code; see JoinBoardClient.
export default async function JoinPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;
  return <JoinBoardClient roomCode={roomCode} />;
}
