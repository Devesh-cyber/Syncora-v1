import { Routes, Route } from 'react-router-dom'
import RequireAuth from './components/RequireAuth.jsx'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Rooms from './pages/Rooms.jsx'
import CreateRoom from './pages/CreateRoom.jsx'
import JoinRoom from './pages/JoinRoom.jsx'
import RoomDetail from './pages/RoomDetail.jsx'
import Activity from './pages/Activity.jsx'
import Profile from './pages/Profile.jsx'
import SignIn from './pages/SignIn.jsx'
import Welcome from './pages/Welcome.jsx'
import Tour from './pages/Tour.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route
        path="/welcome"
        element={
          <RequireAuth allowUnonboarded>
            <Welcome />
          </RequireAuth>
        }
      />
      <Route
        path="/tour"
        element={
          <RequireAuth allowUntoured>
            <Tour />
          </RequireAuth>
        }
      />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="rooms/new" element={<CreateRoom />} />
          <Route path="rooms/join" element={<JoinRoom />} />
          <Route path="rooms/:roomId" element={<RoomDetail />} />
          <Route path="activity" element={<Activity />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
