import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CreditCard, Building } from "lucide-react";

interface PaymentFormProps {
  paymentMethod: 'card' | 'bank';
  amount: number;
  onSubmit: () => void;
  isLoading: boolean;
}

export default function PaymentForm({ paymentMethod, amount, onSubmit, isLoading }: PaymentFormProps) {
  const [formData, setFormData] = useState({
    // Card fields
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    
    // Bank transfer fields
    bankCode: '',
    accountNumber: '',
    accountHolder: '',
    
    // Common fields
    email: '',
    phone: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.length <= 19) { // 16 digits + 3 spaces
      handleInputChange('cardNumber', formatted);
    }
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    if (formatted.length <= 5) { // MM/YY
      handleInputChange('expiryDate', formatted);
    }
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 4) {
      handleInputChange('cvv', value);
    }
  };

  const isFormValid = () => {
    if (paymentMethod === 'card') {
      return formData.cardNumber.replace(/\s/g, '').length >= 13 &&
             formData.expiryDate.length === 5 &&
             formData.cvv.length >= 3 &&
             formData.cardholderName.trim() !== '' &&
             formData.email.trim() !== '';
    } else {
      return formData.bankCode !== '' &&
             formData.accountNumber.trim() !== '' &&
             formData.accountHolder.trim() !== '' &&
             formData.email.trim() !== '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Notice */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-green-800 dark:text-green-200">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-medium">
            Your payment information is encrypted and secure
          </span>
        </div>
      </div>

      {paymentMethod === 'card' ? (
        // Credit Card Form
        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Email Address *
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="cardNumber" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Card Number *
            </Label>
            <div className="relative mt-1">
              <Input
                id="cardNumber"
                type="text"
                placeholder="1234 5678 9012 3456"
                value={formData.cardNumber}
                onChange={handleCardNumberChange}
                className="pl-10"
                required
              />
              <CreditCard className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiryDate" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Expiry Date *
              </Label>
              <Input
                id="expiryDate"
                type="text"
                placeholder="MM/YY"
                value={formData.expiryDate}
                onChange={handleExpiryChange}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="cvv" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                CVV *
              </Label>
              <Input
                id="cvv"
                type="text"
                placeholder="123"
                value={formData.cvv}
                onChange={handleCvvChange}
                className="mt-1"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cardholderName" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Cardholder Name *
            </Label>
            <Input
              id="cardholderName"
              type="text"
              placeholder="John Doe"
              value={formData.cardholderName}
              onChange={(e) => handleInputChange('cardholderName', e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Phone Number (Optional)
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      ) : (
        // Bank Transfer Form
        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Email Address *
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="bankCode" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Bank *
            </Label>
            <Select value={formData.bankCode} onValueChange={(value) => handleInputChange('bankCode', value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select your bank" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bca">BCA (Bank Central Asia)</SelectItem>
                <SelectItem value="mandiri">Bank Mandiri</SelectItem>
                <SelectItem value="bni">BNI (Bank Negara Indonesia)</SelectItem>
                <SelectItem value="bri">BRI (Bank Rakyat Indonesia)</SelectItem>
                <SelectItem value="cimb">CIMB Niaga</SelectItem>
                <SelectItem value="danamon">Bank Danamon</SelectItem>
                <SelectItem value="permata">Bank Permata</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="accountNumber" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Account Number *
            </Label>
            <div className="relative mt-1">
              <Input
                id="accountNumber"
                type="text"
                placeholder="1234567890"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange('accountNumber', e.target.value.replace(/[^0-9]/g, ''))}
                className="pl-10"
                required
              />
              <Building className="w-5 h-5 text-neutral-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>

          <div>
            <Label htmlFor="accountHolder" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Account Holder Name *
            </Label>
            <Input
              id="accountHolder"
              type="text"
              placeholder="John Doe"
              value={formData.accountHolder}
              onChange={(e) => handleInputChange('accountHolder', e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Phone Number (Optional)
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+62 812 3456 7890"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      )}

      {/* Payment Summary */}
      <Card className="bg-neutral-50 dark:bg-muted/20">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-neutral-900 dark:text-foreground">
              Total Amount
            </span>
            <span className="text-2xl font-bold text-primary">
              ${amount.toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <Button
        onClick={onSubmit}
        disabled={!isFormValid() || isLoading}
        className="w-full bg-primary hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors text-lg"
      >
        {isLoading ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Processing Payment...</span>
          </div>
        ) : (
          `Pay $${amount.toFixed(2)}`
        )}
      </Button>

      {/* Security Footer */}
      <div className="text-center text-xs text-neutral-500 dark:text-muted-foreground space-y-1">
        <p>🔒 Your payment is protected by 256-bit SSL encryption</p>
        <p>Powered by Xendit • PCI DSS Compliant</p>
      </div>
    </div>
  );
}
