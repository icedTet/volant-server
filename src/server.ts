import express, { Application } from "express";
import { Server as SocketIOServer } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import { spawn } from "node:child_process";

export class Server {
  private app: Application;
  private io: SocketIOServer;

  private activeSockets: string[] = [];

  private readonly DEFAULT_PORT = 443;

  constructor() {
    this.app = express();
    this.app.use(cors());

    const httpServer = createServer(this.app);
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
    httpServer.listen(this.DEFAULT_PORT);

    console.log(`Starting on ${this.DEFAULT_PORT}`);

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on("connection", (socket) => {
      console.log(`Connection UUID: ${socket.id}`);

      const existingSocket = this.activeSockets.find(
        (existingSocket) => existingSocket === socket.id
      );

      if (!existingSocket) {
        this.activeSockets.push(socket.id);
      }

      const ffmpeg = spawn("ffmpeg", [
        "-re",
        "-thread_queue_size",
        "4096",
        "-f",
        "webm",
        "-r",
        "25",
        "-i",
        "pipe:0",
        // "-f",
        // "lavfi",
        // "-i",
        // "anullsrc=r=48000:cl=stereo",
        "-c:v",
        "copy",
        "-preset",
        "veryFast",
        "-pix_fmt",
        "yuv420p",
        "-acodec",
        "aac",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-f",
        "flv",
        "rtmp://a.rtmp.youtube.com/live2/***REMOVED***",
      ]);

      ffmpeg.stderr.on("data", (data) => {
        console.log(`ffmpeg stderr: ${data}`);
      });

      socket.on("message", (msg) => {
        if (Buffer.isBuffer(msg)) {
          ffmpeg.stdin.write(msg);
        }
      });

      // If the WebSocket connection goes away, clean up ffmpeg
      socket.on("disconnect", (e) => {
        ffmpeg.stdin.end();
        ffmpeg.kill("SIGINT");
      });
    });
  }
}
