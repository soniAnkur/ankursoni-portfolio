// Per-kiosk visit tracking, built on Yuka's StateMachine/State primitives.
// Each kiosk gets its own tiny FSM — unvisited -> entering -> exploring ->
// visited — driven purely by distance-from-car every frame:
//   unvisited  : never been in range.
//   entering   : within outer radius, card fading in/visible, not "done" yet.
//   exploring  : within inner radius; the moment this is first reached the
//                kiosk counts as permanently visited (owner.everExplored)
//                and the one-shot callback fires for the progress HUD /
//                engine.js's onCheckpoint contract.
//   visited    : out of range again, having already explored at least once
//                (distinct from "unvisited" so the progress indicator can
//                tell "never been here" from "done, just driving past").
// The FSM keeps running every future pass too — driving back up to an
// already-visited kiosk still animates entering/exploring, it just no
// longer re-fires the one-shot callback.
import * as YUKA from "yuka";

const OUTER_RADIUS = 16; // card starts fading in
// Kiosks sit ~6.5 units off the lane centerline (see track.js KIOSK_LATERAL)
// so a dead-straight drive-by comfortably crosses this without requiring
// the player to steer precisely onto the pull-off apron.
const INNER_RADIUS = 9; // card fully shown / counts as "explored"
const LEAVE_RADIUS = 20; // hysteresis so the card doesn't flicker right at the boundary

class UnvisitedState extends YUKA.State {
  enter(owner) {
    owner.cardVisible = false;
  }
  execute(owner) {
    if (owner.distance <= OUTER_RADIUS) owner.machine.changeTo("entering");
  }
}

class EnteringState extends YUKA.State {
  enter(owner) {
    owner.cardVisible = true;
  }
  execute(owner) {
    if (owner.distance > LEAVE_RADIUS) {
      owner.machine.changeTo(owner.everExplored ? "visited" : "unvisited");
    } else if (owner.distance <= INNER_RADIUS) {
      owner.machine.changeTo("exploring");
    }
  }
}

class ExploringState extends YUKA.State {
  enter(owner) {
    owner.cardVisible = true;
    if (!owner.everExplored) {
      owner.everExplored = true;
      try {
        owner.onFirstExplored();
      } catch {
        /* caller's handler is not our problem */
      }
    }
  }
  execute(owner) {
    if (owner.distance > INNER_RADIUS) owner.machine.changeTo("entering");
  }
}

class VisitedState extends YUKA.State {
  enter(owner) {
    owner.cardVisible = false;
  }
  execute(owner) {
    if (owner.distance <= OUTER_RADIUS) owner.machine.changeTo("entering");
  }
}

function createKioskOwner(kiosk, onFirstExplored) {
  const owner = {
    kiosk,
    distance: Infinity,
    everExplored: false,
    cardVisible: false,
    machine: null,
    onFirstExplored: () => onFirstExplored(kiosk),
  };
  const machine = new YUKA.StateMachine(owner);
  owner.machine = machine;
  machine.add("unvisited", new UnvisitedState());
  machine.add("entering", new EnteringState());
  machine.add("exploring", new ExploringState());
  machine.add("visited", new VisitedState());
  machine.currentState = machine.states.get("unvisited");
  return owner;
}

/**
 * kiosks: Array<{ key, stageId, subIndex, x, z }> (shape produced by track.js)
 * onFirstExplored(kiosk): called once, the first time that specific kiosk
 * reaches "exploring" (i.e. the moment it counts as visited).
 */
export function createQuestTracker(kiosks, onFirstExplored) {
  const safeCb = typeof onFirstExplored === "function" ? onFirstExplored : () => {};
  const owners = (kiosks || []).map((k) => createKioskOwner(k, safeCb));

  return {
    update(carX, carZ) {
      owners.forEach((owner) => {
        const dx = carX - owner.kiosk.x;
        const dz = carZ - owner.kiosk.z;
        owner.distance = Math.sqrt(dx * dx + dz * dz);
        try {
          owner.machine.update();
        } catch {
          /* a single bad frame shouldn't take down the whole quest tracker */
        }
      });
    },
    // Nearest kiosk currently in card-visible range, or null.
    getActiveCardKiosk() {
      let best = null;
      owners.forEach((owner) => {
        if (owner.cardVisible && (!best || owner.distance < best.distance)) best = owner;
      });
      return best ? best.kiosk : null;
    },
    // { [stageId]: { done, total } } — drives the progress indicator.
    getProgress() {
      const summary = {};
      owners.forEach((owner) => {
        const id = owner.kiosk.stageId;
        if (!summary[id]) summary[id] = { done: 0, total: 0 };
        summary[id].total += 1;
        if (owner.everExplored) summary[id].done += 1;
      });
      return summary;
    },
  };
}
