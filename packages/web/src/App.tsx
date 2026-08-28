import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AlbumPage } from "./features/album/AlbumPage";
import { BacklogPage } from "./features/backlog/BacklogPage";
import { NowPlayingPage } from "./features/now-playing/NowPlayingPage";
import { RevisitPage } from "./features/revisit/RevisitPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { NotFoundPage } from "./routes/pages";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <NowPlayingPage /> },
      { path: "backlog", element: <BacklogPage /> },
      { path: "album/:id", element: <AlbumPage /> },
      { path: "revisit", element: <RevisitPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
