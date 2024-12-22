import { library } from "@fortawesome/fontawesome-svg-core";
import { faPaperclip } from "@fortawesome/free-solid-svg-icons";
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import Avatar from "./Avatar";
import Logo from "./Logo";
import { useEffect, useState, useContext, useRef } from "react";
import { UserContext } from "./UserContext";
import Contact from "./Contact";
import axios from "axios";
import { uniqBy } from "lodash";
import { faBars } from '@fortawesome/free-solid-svg-icons'; 


library.add(faUser);

export default function Chat() {
  const [ws, setWs] = useState(null);
  const [onlinePeople, setOnlinePeople] = useState({});
  const [offlinePeople, setOfflinePeople] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newMessageText, setNewMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const { username, id, setId, setUsername } = useContext(UserContext);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const divUnderMessages = useRef();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    connectToWs();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);
  function connectToWs() {
    const wsUrl = `${import.meta.env.VITE_API_URL.replace(/^http/, "ws")}/ws`;
    console.log("Connecting to WebSocket at:", wsUrl); 
    const wsInstance = new WebSocket(wsUrl);
    setWs(wsInstance);
    wsInstance.addEventListener("message", handleMessage);
    wsInstance.addEventListener("close", () => {
      console.log("WebSocket disconnected, attempting to reconnect...");
      setTimeout(connectToWs, 3000); 
    });
    wsInstance.addEventListener("error", (err) => {
      console.error("WebSocket connection error:", err);
    });
  }
  const toggleVisibility = () => {
    setIsVisible(!isVisible); 
};
  const handleHighlight = (messageId) => {
    setHighlightedMessageId(prevId => (prevId === messageId ? null : messageId));
  };
  function handleMessage(ev) {
    console.log("Received message:", ev.data);
    try {
      const messageData = JSON.parse(ev.data);
      if(messageData.uniqueonline) {
      //if (messageData.online) {
        showOnlinePeople(messageData.uniqueonline);
        //showOnlinePeople(messageData.online);
      } else if (messageData.text || messageData.file) {
        setMessages((prev) => {
          const updatedMessages = uniqBy([...prev, messageData], "_id");
          localStorage.setItem(`messages-${selectedUserId}`, JSON.stringify(updatedMessages));
          return updatedMessages;
      });
    } else if (messageData.action === 'delete' && messageData.messageId) {
      setMessages((prev) => {
          if (!prev) return []; 
          const updatedMessages = prev.filter(msg => msg._id !== messageData.messageId);
          localStorage.setItem(`messages-${selectedUserId}`, JSON.stringify(updatedMessages));
          return updatedMessages;
      });
  }
} catch (error) {
  console.error("Error parsing WebSocket message:", error);
}
}
  function showOnlinePeople(peopleArray) {
    const people = {};
    peopleArray.forEach(({ userId, username }) => {
      people[userId] = username;
    });
    setOnlinePeople(people);
  }
  useEffect(() => {
    axios.get("/people").then((res) => {
      const offline = res.data
        .filter((p) => p._id !== id)
        .filter((p) => !Object.keys(onlinePeople).includes(p._id));
      const offlinePeopleObj = {};
      offline.forEach((p) => (offlinePeopleObj[p._id] = p));
      setOfflinePeople(offlinePeopleObj);
    });
  }, [onlinePeople]);

  useEffect(() => {
    console.log("Selected User ID:", selectedUserId);
    if (!selectedUserId) return;
    const storedMessages = localStorage.getItem(`messages-${selectedUserId}`);
    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    } else {
      axios.get(`/messages/${selectedUserId}`)
      .then((res) => {
        setMessages(res.data);
        localStorage.setItem(`messages-${selectedUserId}`, JSON.stringify(res.data));
      })
      .catch(console.error);
  }
}, [selectedUserId]);

useEffect(() => {
  const filePath = localStorage.getItem('uploadedFile');
  if (filePath) {
      setUploadedFile(filePath);
  }
}, []);

  function sendMessage(ev, file = null) {
    ev?.preventDefault();
    if (!newMessageText.trim() && !file) return;

    const messagePayload = {
      recipient: selectedUserId,
      text: newMessageText,
      file,
    };
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(messagePayload));    
      setMessages((prev) => {
      const newMessages = [
        ...prev,
        { ...messagePayload, sender: id, _id: Date.now() },
      ];
      localStorage.setItem(`messages-${selectedUserId}`, JSON.stringify(newMessages));
      return newMessages;
      });
      setNewMessageText(""); 
    } else {
      console.error("WebSocket is not open.");
    }
  }
  const currentUserId = 'userId';  
   useEffect(() => {
    const socket = new WebSocket(`${import.meta.env.VITE_API_URL}/ws`);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.action === 'delete' && data.messageId) {
        setMessages((prevMessages) => 
          prevMessages.filter((msg) => msg._id !== data.messageId)
        );
      }
    }; 
    return () => socket.close(); t
  }, []);
const handleDelete = (messageId) => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: "delete",
      messageId,
      recipient: selectedUserId,
    }));
    deleteMessage(messageId); 
  }
};
const deleteMessage = (messageId) => {
  setMessages((prevMessages) => {
    const updatedMessages = prevMessages.filter((msg) => msg._id !== messageId); 
    localStorage.setItem(`messages-${selectedUserId}`, JSON.stringify(updatedMessages));
    return updatedMessages;
  });
};
useEffect(() => {
  console.log("Updated messages:", messages);
}, [messages]);
  
  function sendFile(ev) {
    const formData = new FormData();
    formData.append("file", ev.target.files[0]);
    axios
    .post("/upload", formData)
    .then((response) => {
      const filePath = response.data.filePath;
      sendMessage(null, { filePath });
    })
    .catch((err) => console.error("Error uploading file:", err));
}
  function logout() {
    axios.post("/logout").then(() => {
      setWs(null);
      setId(null);
      setUsername(null);
    });
  }

  useEffect(() => {
    console.log("Selected user ID:", selectedUserId);
    console.log("Messages:", messages);
  }, [selectedUserId, messages]);
  
  useEffect(() => {
    ws?.addEventListener("error", (err) => {
      console.error("WebSocket error:", err);
    });
  }, [ws]);
  
  useEffect(() => {
    divUnderMessages.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onlineExcludingSelf = { ...onlinePeople };
  delete onlineExcludingSelf[id];

  const renderFile = (file) => { 
    if (!file || !file.filePath) return null; 
    const fileExtension = file.filePath.split('.').pop().toLowerCase();  
    const fileUrl = `${import.meta.env.VITE_API_URL}${file.filePath}`; 
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExtension)) {
      return <img src={fileUrl} alt="file" className="w-96" />;
    }
    if (fileExtension === 'pdf') {
      return <iframe src={fileUrl} className="w-full h-96" title="PDF file" />;
    }
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
        <button className="btn btn-primary">Download {fileExtension.toUpperCase()} File</button>
      </a>
    );
  };
  
    
  return (
<div className="flex flex-col h-full">
<div className="flex items-center justify-between  bg-white w-full fixed z-10 px-4 py-2 shadow-md">
         <div className="flex ">
            <Logo />
            <FontAwesomeIcon
              icon={faBars}
              className="w-4 items-center h-4 ml-4 pt-3 cursor-pointer"
              onClick={toggleVisibility}
            />
            </div>
            <div className="flex items-center justify-center p-1 bg-gray-400">
            <span className="text-sm text-gray-800">
              <FontAwesomeIcon icon={faUser} /> {username}
            </span>
             <button
             onClick={logout}
             className="bg-blue-500 py-1 px-2 border rounded text-sm text-white"
           >
             Logout
           </button>
           </div>
        </div>
    <div className="flex h-screen flex-row">
      {isVisible && (    
      <div className="bg-white pt-12 px-2 lg:w-1/4 sm:w-1/3 text-sm flex flex-col">       
        <div className="flex-grow overflow-y-auto">
          {Object.keys(onlineExcludingSelf).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              online={true}
              username={onlineExcludingSelf[userId]}
              onClick={() => setSelectedUserId(userId)}
              selected={userId === selectedUserId}
            />
          ))}
          {Object.keys(offlinePeople).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              online={false}
              username={offlinePeople[userId]?.username}
              onClick={() => setSelectedUserId(userId)}
              selected={userId === selectedUserId}
            />
          ))}
        </div>
        <div className="flex items-center justify-center p-3 bg-gray-400">
          <span className="mr-1 text-sm text-gray-800 ">
            <FontAwesomeIcon icon={faUser} /> {username}
          </span>
          <button
            onClick={logout}
            className="bg-blue-500 py-1 px-2 border rounded text-sm text-white"
          >
            Logout
          </button>
        </div>
      </div>
      )}
      
       
      <div className={`flex flex-col bg-gray-200 w-full ${!isVisible ? "h-full" : ""}`}>     
        <div className="flex-grow overflow-y-scroll">
          {!selectedUserId ? (
            <div className="flex h-full items-center justify-center text-gray-300">
              &larr; Select a user to start chatting
            </div> 
          ) : (
            <div className="relative h-full">
              <div className="absolute inset-0 overflow-y-scroll">
                {messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`${
                      msg.sender === id ? "flex justify-end" : "flex justify-start"
                    }`}
                    onClick={() => handleHighlight(msg._id)} 
                  >
                    <div
                      className={`relative inline-block cursor-pointer p-2 m-2 rounded text-sm ${
                        msg.sender === id
                          ? "bg-blue-500 text-white"
                          : "bg-black text-white"
                      }${highlightedMessageId === msg._id ? "bg-yellow-300" : ""}`} >
                      {msg.text}
                      {msg.file && renderFile(msg.file)}

    {highlightedMessageId === msg._id && (
                      <button
                    onClick={() => deleteMessage(msg._id)}
                    className="absolute top-1 -left-4 px-2 text-red-500 hover:text-red-700"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>  
                    )}                                       
                    </div>
                  </div>
                ))}
                <div ref={divUnderMessages}></div>
              </div>
            </div>
          )}
        </div>

        {selectedUserId && (
          <div>
          {uploadedFile && (
            <div className="flex justify-center mb-3">
              <img
                src={`${import.meta.env.VITE_API_URL}${uploadedFile}`}
                alt="Uploaded"
                className="max-h-48 rounded shadow"
              />
            </div>
          )}
           <form onSubmit={sendMessage}  className="flex sm:flex-row items-center sm:w-full sm:px-4 sm:py-2 md:px-5 md:py-3">
            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type a message..."
              className="flex-grow p-3 rounded-lg border focus:outline-none"
              
            />
            <label className='bg-gray-50 cursor-pointer px-3 py-2 '>
              <input type="file" className='hidden' onChange={sendFile}/>
              <FontAwesomeIcon icon={faPaperclip} className="text-gray-900 text-2xl" />
              </label>
            <button
              type="submit"
              className="bg-blue-500 text-white p-2 mr-3 rounded-r"
            >
              Send
            </button>
          </form>
          </div>
        )}
      </div>
    </div>
    </div>

  );
}

