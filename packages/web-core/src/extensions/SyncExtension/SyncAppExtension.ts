import {BaseExtension} from "../../framework/BaseExtension";
import {DbEventsService} from "./DbEventsService";

export class SyncAppExtension extends BaseExtension {
  async register() {
   this.container.bind(DbEventsService).toSelf();
  }
}
