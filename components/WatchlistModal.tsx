import React from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: { symbol: string; name: string }[];
  onRemoveFromWatchlist: (symbol: string) => void;
}

export function WatchlistModal({ isOpen, onClose, watchlist, onRemoveFromWatchlist }: WatchlistModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Watchlist</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {watchlist.length === 0 ? (
            <p className="text-center text-gray-500">Your watchlist is empty</p>
          ) : (
            <ul className="space-y-2">
              {watchlist.map((stock) => (
                <li key={stock.symbol} className="flex justify-between items-center">
                  <span>{stock.symbol} - {stock.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFromWatchlist(stock.symbol)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

