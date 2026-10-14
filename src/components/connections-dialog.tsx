"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./ui";
import type { Bookmark } from "@/lib/types";
export function ConnectionsDialog({
  bookmarks,
  onClose,
  onOpen,
}: {
  bookmarks: Bookmark[];
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let canceled = false;
    void import("three")
      .then((THREE) => {
        const el = mount.current;
        if (!el || canceled) return;
        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        } catch {
          setError("Your browser doesn’t support this view. Your library is available below.");
          return;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute(
          "aria-label",
          "Drag to explore the connections in your library",
        );
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.z = 8;
        const group = new THREE.Group();
        scene.add(group);
        const colors: Record<string, string> = {
          Design: "#b59cc8",
          Development: "#83acbf",
          Reading: "#d4b786",
          Inspiration: "#d9bc59",
          "Life & living": "#91aa7d",
          Unsorted: "#bdbcb3",
        };
        const objects: InstanceType<typeof THREE.Mesh>[] = [];
        const shown = bookmarks.slice(0, 150);
        shown.forEach((b, i) => {
          const phi = Math.acos(1 - (2 * (i + 0.5)) / shown.length);
          const theta = i * 2.399963;
          const node = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 14, 14),
            new THREE.MeshBasicMaterial({ color: colors[b.topic] }),
          );
          node.position.set(
            2.5 * Math.cos(theta) * Math.sin(phi),
            2.5 * Math.sin(theta) * Math.sin(phi),
            2.5 * Math.cos(phi),
          );
          node.userData.id = b.id;
          group.add(node);
          objects.push(node);
        });
        for (let i = 0; i < objects.length; i++)
          for (let j = i + 1; j < objects.length; j++)
            if (
              shown[i].topic === shown[j].topic &&
              objects[i].position.distanceTo(objects[j].position) < 2.8
            ) {
              const geo = new THREE.BufferGeometry().setFromPoints([
                objects[i].position,
                objects[j].position,
              ]);
              group.add(
                new THREE.Line(
                  geo,
                  new THREE.LineBasicMaterial({
                    color: colors[shown[i].topic],
                    transparent: true,
                    opacity: 0.2,
                  }),
                ),
              );
            }
        const resize = () => {
          renderer.setSize(el.clientWidth, 350);
          camera.aspect = el.clientWidth / 350;
          camera.updateProjectionMatrix();
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(el);
        let lastX = 0,
          lastY = 0,
          drag = false,
          moved = false;
        const down = (e: PointerEvent) => {
          drag = true;
          moved = false;
          lastX = e.clientX;
          lastY = e.clientY;
          renderer.domElement.setPointerCapture(e.pointerId);
        };
        const move = (e: PointerEvent) => {
          if (!drag) return;
          const dx = e.clientX - lastX,
            dy = e.clientY - lastY;
          if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
          group.rotation.y += dx * 0.007;
          group.rotation.x += dy * 0.007;
          lastX = e.clientX;
          lastY = e.clientY;
        };
        const up = (e: PointerEvent) => {
          drag = false;
          if (moved) return;
          const rect = renderer.domElement.getBoundingClientRect();
          const ray = new THREE.Raycaster();
          ray.setFromCamera(
            new THREE.Vector2(
              ((e.clientX - rect.left) / rect.width) * 2 - 1,
              (-(e.clientY - rect.top) / rect.height) * 2 + 1,
            ),
            camera,
          );
          const hits = ray.intersectObjects(objects);
          if (hits[0]) onOpen(hits[0].object.userData.id);
        };
        renderer.domElement.addEventListener("pointerdown", down);
        renderer.domElement.addEventListener("pointermove", move);
        renderer.domElement.addEventListener("pointerup", up);
        let frame = 0;
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const tick = () => {
          if (!drag && !reduced && document.visibilityState === "visible")
            group.rotation.y += 0.001;
          renderer.render(scene, camera);
          frame = requestAnimationFrame(tick);
        };
        tick();
        dispose = () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          renderer.domElement.removeEventListener("pointerdown", down);
          renderer.domElement.removeEventListener("pointermove", move);
          renderer.domElement.removeEventListener("pointerup", up);
          group.traverse((obj) => {
            if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
              obj.geometry.dispose();
              const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
              materials.forEach((m) => m.dispose());
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => setError("This view could not load. Your library is available below."));
    return () => {
      canceled = true;
      dispose?.();
    };
  }, [bookmarks, onOpen]);
  return (
    <Modal
      title="Follow a little thread."
      subtitle="Each point is a bookmark. Shared topics bring them together. Drag to explore."
      onClose={onClose}
      wide
    >
      <div className="connections-canvas" ref={mount} />
      {error && <p className="small muted">{error}</p>}
      <div className="connections-list">
        {bookmarks.slice(0, 150).map((b) => (
          <button key={b.id} onClick={() => onOpen(b.id)}>
            <span
              className={`color-dot ${b.topic === "Design" ? "lilac" : b.topic === "Development" ? "blue" : "green"}`}
            />
            {b.title}
          </button>
        ))}
      </div>
    </Modal>
  );
}
