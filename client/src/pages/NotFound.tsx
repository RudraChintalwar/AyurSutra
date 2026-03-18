import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ayur-earth-beige to-white">
      <div className="text-center space-y-6 p-8">
        <div className="text-8xl font-playfair font-bold text-primary/20">
          404
        </div>
        <h1 className="font-playfair text-3xl font-bold text-foreground">
          Page Not Found
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          The path you seek has not been charted in our ancient texts. Perhaps
          you took a wrong turn on the journey to wellness.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => navigate("/")}
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
