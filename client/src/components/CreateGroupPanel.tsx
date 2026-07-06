import { useState } from "react";
import type { ContactUser } from "../api/users";
import { createGroup } from "../api/groups";
import type { Group } from "../api/groups";

type CreateGroupPanelProps = {
    contacts: ContactUser[];
    onClose: () => void;
    onGroupCreated: (group: Group) => void;
};

function CreateGroupPanel({
    contacts,
    onClose,
    onGroupCreated,
}: CreateGroupPanelProps) {
    const [groupName, setGroupName] = useState("");
    // The ids of contacts the user has ticked
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [feedback, setFeedback] = useState("");
    const [isShaking, setIsShaking] = useState(false);

    // Tick / untick a contact
    function toggleMember(contactId: string) {
        setSelectedMemberIds((previous) => {
            if (previous.includes(contactId)) {
                // Already selected -> remove it
                return previous.filter((id) => id !== contactId);
            } else {
                // Not selected -> add it
                return [...previous, contactId];
            }
        });
    }

    // Trigger a shake, then remove the class so it can fire again next time
    function triggerShake() {
        setIsShaking(true);
        setTimeout(() => {
            setIsShaking(false);
        }, 400); // matches the 0.4s animation length
    }

    async function handleCreate() {
        setFeedback("");

        if (groupName.trim() === "") {
            setFeedback("Please enter a group name");
            triggerShake();
            return;
        }
        if (selectedMemberIds.length === 0) {
            setFeedback("Please select at least one member");
            triggerShake();
            return;
        }

        try {
            const newGroup = await createGroup(groupName, selectedMemberIds);
            onGroupCreated(newGroup);
        } catch (error) {
            if (error instanceof Error) {
                setFeedback(error.message);
            } else {
                setFeedback("Something went wrong");
            }
            triggerShake();
        }
    }

    return (
        <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className={
                    "bg-white text-gray-800 rounded-xl w-full max-w-sm p-6 shadow-xl " +
                    (isShaking ? "shake" : "")
                }
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold text-purple-700 mb-4">New Group</h2>

                <label className="block text-sm font-semibold mb-1">Group name</label>
                <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Weekend Plans"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:border-purple-500"
                />

                <label className="block text-sm font-semibold mb-2">
                    Add members
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg mb-4">
                    {contacts.length === 0 ? (
                        <p className="text-gray-400 text-sm p-3">No contacts to add.</p>
                    ) : (
                        contacts.map((contact) => (
                            <label
                                key={contact._id}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedMemberIds.includes(contact._id)}
                                    onChange={() => toggleMember(contact._id)}
                                />
                                <span>{contact.username}</span>
                            </label>
                        ))
                    )}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleCreate}
                        className="flex-1 bg-purple-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                    >
                        Create
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                    >
                        Cancel
                    </button>
                </div>

                {feedback !== "" && (
                    <p className="text-center text-sm mt-4 text-red-600 bg-red-50 rounded-lg py-2 px-3">
                        {feedback}
                    </p>
                )}
            </div>
        </div>
    );
}

export default CreateGroupPanel;