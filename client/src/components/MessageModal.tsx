import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Smile } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient?: {
    id: string;
    name: string;
    avatar?: string;
    role: 'doctor' | 'patient';
  };
}

const MessageModal: React.FC<MessageModalProps> = ({ isOpen, onClose, recipient }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const { language } = useLanguage();
  const tx = (en: string, hi: string) => (language === 'hi' ? hi : en);
  const { toast } = useToast();

  const handleSend = () => {
    if (!message.trim()) {
      toast({
        title: tx("Error", "त्रुटि"),
        description: tx("Please enter a message", "कृपया संदेश दर्ज करें"),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: tx("Message Sent!", "संदेश भेजा गया!"),
      description: language === 'hi'
        ? `आपका संदेश ${recipient?.name || 'प्राप्तकर्ता'} को भेज दिया गया है`
        : `Your message has been sent to ${recipient?.name || 'the recipient'}`,
    });

    // Reset form
    setSubject('');
    setMessage('');
    setPriority('normal');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <Send className="w-5 h-5 text-primary" />
            <span>{tx("Send Message", "संदेश भेजें")}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Info */}
          {recipient && (
            <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
              <Avatar>
                <AvatarImage src={recipient.avatar} />
                <AvatarFallback>
                  {recipient.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{recipient.name}</div>
                <Badge variant="outline" className="text-xs">
                  {recipient.role === 'doctor' ? tx('Doctor', 'डॉक्टर') : tx('Patient', 'रोगी')}
                </Badge>
              </div>
            </div>
          )}

          {/* Message Form */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subject">{tx("Subject", "विषय")}</Label>
                <Input
                  id="subject"
                  placeholder={tx("Enter subject...", "विषय दर्ज करें...")}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="priority">{tx("Priority", "प्राथमिकता")}</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{tx("Low", "कम")}</SelectItem>
                    <SelectItem value="normal">{tx("Normal", "सामान्य")}</SelectItem>
                    <SelectItem value="high">{tx("High", "उच्च")}</SelectItem>
                    <SelectItem value="urgent">{tx("Urgent", "अत्यावश्यक")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="message">{tx("Message", "संदेश")}</Label>
              <Textarea
                id="message"
                placeholder={tx("Type your message here...", "अपना संदेश यहाँ लिखें...")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Paperclip className="w-4 h-4 mr-2" />
                {tx("Attach File", "फ़ाइल संलग्न करें")}
              </Button>
              <Button variant="outline" size="sm">
                <Smile className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={onClose}>
                {tx("Cancel", "रद्द करें")}
              </Button>
              <Button onClick={handleSend} className="ayur-button-hero">
                <Send className="w-4 h-4 mr-2" />
                {tx("Send Message", "संदेश भेजें")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MessageModal;