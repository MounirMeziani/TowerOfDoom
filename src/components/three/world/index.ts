// 3D world barrel: environments, NPCs and layout constants. Client-only (load with next/dynamic ssr:false).
export { LobbyHall } from "./LobbyHall";
export { FloorRoom, type FloorRoomProps } from "./FloorRoom";
export { SenseiModel, type SenseiModelProps } from "./SenseiModel";
export { VillainFigure, type VillainFigureProps } from "./VillainFigure";
export { SpeechBubble, type SpeechBubbleProps } from "./SpeechBubble";
export { TowerCutaway, TowerCutawayCamera, cutawayZoom, type CutawayPlayer, type TowerCutawayProps } from "./TowerCutaway";
export { SkyBackdrop, type SkyVariant } from "./SkyBackdrop";
export { DoomEye } from "./DoomEye";
export {
  LOBBY_BOUNDS,
  LOBBY_OBSTACLES,
  lobbySpawn,
  lobbySpawnFor,
  LOBBY_PILLARS,
  ELEVATOR_POS,
  ROOM_BOUNDS,
  ROOM_OBSTACLES,
  PLAYER_SPAWN,
  SENSEI_POS,
  STAIRS_POS,
  VILLAIN_POS,
  TALK_RADIUS,
  STAIRS_RADIUS,
} from "./constants";
