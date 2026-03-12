// ======================================================
// CreateStore.jsx
// ======================================================
// SuperAdmin yahan se new store create karega
// ======================================================

import { useState } from "react";
import { createStore } from "../../modules/stores/storeService";
import toast from "react-hot-toast";

const CreateStore = () => {

  const [name, setName] = useState("");

  const handleCreate = async () => {
    try {
      await createStore({ name });
      toast.success("Store Created ✅");
    } catch (error) {
      toast.error("Error creating store");
    }
  };

  return (
    <div className="p-6">
      <h2>Create Store</h2>

      <input
        type="text"
        placeholder="Store Name"
        onChange={(e) => setName(e.target.value)}
        className="border p-2"
      />

      <button
        onClick={handleCreate}
        className="bg-black text-white px-4 py-2 ml-2"
      >
        Create
      </button>
    </div>
  );
};

export default CreateStore;