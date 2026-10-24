// True in the build made with `npm run build:playground`, which runs on simulated agents.
export const isPlayground = import.meta.env.MODE === "playground";
