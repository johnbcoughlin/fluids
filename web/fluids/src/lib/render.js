import {GPUTimer} from "./gpu_timer";

export class Render {
  timer: GPUTimer;
  timingName: ?string;

  constructor(timer: GPUTimer, timingName?: string) {
    this.timer = timer;
    this.timingName = timingName;
  }

  doRender(level?: number) {
    // no-op
  }

  render(level?: number) {
    this.timer.timeCall(this.timingName + (level == null ? "" : "-" + level), () => {
      this.doRender(level);
    });
  }
}