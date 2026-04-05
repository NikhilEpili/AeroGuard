import { motion } from "framer-motion";

export default function Loader({ label = "Loading..." }) {
  return (
    <div className="w-full min-h-[220px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <motion.div
          className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-primary"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
    </div>
  );
}
